# Mubu Smooth Scrolling, Smooth Zoom & Configurable Font Override — Edge Extension

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-2EA44F?style=flat-square" alt="License: MIT" />
  <img src="https://img.shields.io/badge/Edge-%E2%89%A5111-0078D7?style=flat-square" alt="Edge >= 111" />
  <img src="https://img.shields.io/badge/Node.js-%3E%3D22-339933?style=flat-square&amp;logo=nodedotjs&amp;logoColor=white" alt="Node.js >= 22" />
</p>
<p align="center">English · <a href="README.md">中文</a></p>

Manifest V3 extension for Microsoft Edge (Chromium) that (a) replaces the discrete, per-event
pan/zoom response of [mubu.com](https://mubu.com) — now served from [imubu.com](https://imubu.com) — with an eased, accumulative response, and
(b) applies a user-selected system font over both DOM text and canvas-rendered text.

The implementation performs **no bundle patching, no request interception, and no network
proxying**; all behaviour is injected at runtime through content scripts and standard browser APIs.

---

## 1. Overview

Mubu is a browser-based outliner and mind-mapper. Its outline view is a conventional DOM
scrolling container, but its mind-map view renders into a WebGL canvas and implements panning
and zooming by consuming raw `wheel` deltas directly — one discrete translation or scale
step per event, with no interpolation. On precision pointing devices this produces a visibly
quantised, non-inertial response.

This extension interposes a **first-order exponential smoothing accumulator** between the input
device and the site's own event handlers. It does not reimplement panning or zooming; it feeds
the site's existing handlers a sequence of attenuated deltas over successive animation frames,
so the site remains the single source of truth for camera state and hit-testing.

The font feature is independent of the input work: it overrides `font-family` through the
CSSOM for DOM nodes and through a descriptor rewrite of `CanvasRenderingContext2D.prototype.font`
for canvas text, which is the only reliable way to affect text that is rasterised into a
`<canvas>` element.

### Non-goals

- Not a proxy, MITM, or offline mirror; the site is loaded unmodified from its own origin.
- Not a userscript bundler; nothing is injected as inline script (see §9).
- Does not touch document content, sync, authentication, or telemetry.
- Does not attempt to smooth the outline view's scrolling; that path is left to the user agent.

---

## 2. Feature Matrix

| Capability | Mechanism | Affected scope |
| --- | --- | --- |
| Wheel panning | Capture-phase listener → accumulator → eased synthetic `wheel` re-dispatch | Mind-map canvas (`.minder-container`) |
| Wheel zooming (Ctrl/⌘) | Same pipeline, anchored at the pointer, with DPR-corrected coordinates | Mind-map canvas |
| DOM font override | Injected `style` element, selector list `html, body, *`, `!important` | All DOM text and UI on `mubu.com` and `imubu.com` (incl. subdomains) |
| Canvas font override | `CanvasRenderingContext2D.prototype.font` accessor rewrite | Mind-map topic labels, canvas-rendered text |
| Font selection | `chrome.fontSettings.getFontList()` + `chrome.storage.sync` | Extension popup |

---

## 3. Compatibility

| Component | Minimum | Notes |
| --- | --- | --- |
| Browser | Edge 111 | Requires `"world": "MAIN"` content scripts (Chromium 111+) |
| Platform | Windows / macOS / Linux | Any platform running Edge |
| Node.js (script mode only) | 22 | Requires the global `WebSocket` binding and ESM support |
| Target pages | `https://mubu.com/*`, `https://*.mubu.com/*`, `https://imubu.com/*`, `https://*.imubu.com/*` | Matched by both content-script entries. The application migrated the document host from `mubu.com` to `imubu.com` and rewrites URLs accordingly (see §16). |

Validated on Edge 157.0.4341.60 (Chromium 157), Windows, `devicePixelRatio = 1.25`,
with approximately 229 installed font families enumerated.

---

## 4. Installation

### 4.1 Unpacked extension (recommended)

1. Navigate to `edge://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose the repository directory that contains `manifest.json`.
4. Open or reload any page under `mubu.com` or `imubu.com`.
5. Click the toolbar icon to open the configuration popup.

**Permissions requested**

| Permission | Rationale |
| --- | --- |
| `storage` | Persists the selected font family (`chrome.storage.sync`). |
| `fontSettings` | Enumerates installed font families via `getFontList()`. The API is read-only in this extension; no font or system setting is modified. Edge surfaces the warning *"Read and change your font settings"*. |

**Upgrading.** The manifest declares new permissions relative to v1.0.x. Edge disables the
extension until the new permissions are accepted; remove the previous entry and load unpacked again.

### 4.2 Script mode (CDP, no installation)

Requires Node.js 22 or newer.

```bash
node mubu_smooth_scroll.mjs
```

The launcher spawns Edge with `--remote-debugging-port`, attaches to a fresh target, and registers the
patch via `Page.addScriptToEvaluateOnNewDocument`. The process must remain alive; `Ctrl+C` terminates it.

| Environment variable | Description | Default |
| --- | --- | --- |
| `EDGE_PATH` | Absolute path to `msedge.exe` | `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` |
| `MUBU_URL` | Initial URL | `https://imubu.com/app` |
| `MUBU_PORT` | DevTools protocol port | `9222` |
| `MUBU_FONT` | Font family; empty string disables the override | `Noto Serif SC` |

---

## 5. Usage

### 5.1 Interaction model

1. Open any page under `mubu.com` or `imubu.com`.
2. Click the extension icon. Pin it through the extensions (puzzle-piece) menu if it is hidden.
3. Select a family from the list, or type one directly into the input field.
4. Press **Save and Apply**.
5. Press **Refresh the page** once, so that canvas text is re-rasterised.

### 5.2 Panel semantics

| Control | Behaviour |
| --- | --- |
| Font list (single click) | Copies the family name into the input field only; **does not commit**. |
| Search field | Case-insensitive substring filter over the enumerated families. |
| Manual entry | Accepts any family name, including families the browser does not report. |
| Frequently-used chips | Commits and applies immediately (no confirmation step). |
| **Save and Apply** | Writes `{ fontFamily }` to `chrome.storage.sync`; propagates to all open tabs through `storage.onChanged`. |
| **Refresh page** | `chrome.tabs.reload()` on the active tab. |

### 5.3 Panel label reference

The popup is localised in Chinese; the following table maps each label.

| Label | Meaning |
| --- | --- |
| 幕布设置 | Mubu Settings |
| 字体 / 平滑滚动 / 平滑缩放 | Font / Smooth scrolling / Smooth zooming |
| 搜索已安装字体（如 宋体、思源、Noto） | Search installed fonts |
| （不修改字体 / 幕布默认） | Do not override the font (use Mubu's default) |
| 字体名称（留空=不修改字体） | Font family name (empty means no override) |
| 保存并应用 | Save and Apply |
| 刷新页面 | Refresh page |
| 常用字体 | Frequently used fonts |
| 已保存：… | Saved: … |
| 已读取 N 个已安装字体 | N installed fonts enumerated |

### 5.4 Persisted state

| Channel | Key | Semantics |
| --- | --- | --- |
| `chrome.storage.sync` | `fontFamily` | Authoritative selection. Absent means default `Noto Serif SC`; empty string disables the override. |
| DOM attribute | `<html data-mubu-font-family>` | Cross-world transport, consumed by the main-world script. |
| `localStorage` (site origin) | `__mubu_font_family` | Write-through cache enabling pre-paint application on reload. |

---

## 6. Architecture

### 6.1 Component map

| Artifact | Execution context | Responsibility |
| --- | --- | --- |
| `content-bridge.js` | Isolated world, `document_start` | Reads `chrome.storage.sync`, publishes the selection to the DOM attribute and the `localStorage` mirror, subscribes to `storage.onChanged`. |
| `content.js` | Main world, `document_start` | Observes the attribute (`MutationObserver`), maintains the CSS and canvas font overrides, implements wheel accumulation and re-dispatch. |
| `popup.html` / `popup.js` | Extension page | Enumerates families, renders the panel, commits the selection, reloads the active tab. |
| `manifest.json` | — | MV3 declaration: two content-script entries, permissions, action popup. |
| `smooth-scroll.patch.js` | — | Verbatim copy of `content.js`, consumed by script mode. |
| `mubu_smooth_scroll.mjs` | Node.js | CDP launcher for script mode. |

### 6.2 Execution contexts

The canvas font override must mutate `CanvasRenderingContext2D.prototype` **in the page's own
JavaScript realm**; otherwise the site's contexts are unaffected. That requires
`world: "MAIN"`. Extension APIs (`chrome.storage`, `chrome.fontSettings`) are **not** exposed
to main-world content scripts. The two constraints are mutually exclusive within a single script,
hence the split:

- isolated world — privileged extension APIs;
- main world — page-realm mutation.

The worlds share the DOM but not JavaScript objects, so the transport is DOM-backed (§6.3).

### 6.3 State channels

`content-bridge.js` is the only writer of the attribute; `content.js` is the only reader. The
attribute is a primitive string, therefore it crosses the world boundary without object wrapping,
structured-clone cost, or origin checks.

The `localStorage` mirror exists for latency reasons: `storage.sync.get` is asynchronous and may
resolve after first paint, whereas `localStorage` is synchronous and readable at
`document_start`. Measured time-to-attribute after a reload: approximately 0.4 s from
navigation start, dominated by document creation rather than by the cache read.

### 6.4 Control flow

```text
trusted wheel event
  └─ document [capture, passive:false]
       ├─ metaKey/ctrlKey/altKey guard .......... bail out (UA zoom / OS gestures)
       ├─ overMind(clientX, clientY)? ........... no  ▸ bail out (native handling)
       └─ preventDefault() + stopPropagation()
            ├─ (ctrl|meta)  ▸ zoom accumulator ─┐
            └─ otherwise    ▸ pan accumulator  ─┤
                                                ▼
                        requestAnimationFrame loop
                          Δ = (T − V) · α ;  V ← V + Δ
                          dispatch WheelEvent{ deltaX|deltaY: Δ, ... }
                                                │
                                                ▼
                          site handler consumes Δ → camera state
```

---

## 7. Algorithms

### 7.1 Discrete-to-continuous input smoothing

Each wheel event contributes to an accumulator rather than being applied directly:

- the target `T` accumulates the normalised input delta: `T ← T + Δ_in`;
- the visible value `V` chases `T` by first-order exponential smoothing:
  `V ← V + α · (T − V)`, with `α = 0.18`;
- the per-frame emission is the increment `Δ_out = α · (T − V)`;
- termination when `|T − V| < 0.5` for panning, or `|T − V| < 0.05` for zoom delta units.

Properties: the mapping is strictly monotone in `T`; the response is frame-rate independent up
to the sampling of `α`; convergence is geometric (about 12 frames to 90 % of target at 60 Hz);
and multiple events issued within the same frame are **accumulated** rather than collapsed — the
defect that motivated this work.

### 7.2 Synthetic event redirection and re-entrancy

The eased increment is delivered as a **synthetic** `WheelEvent` dispatched to
`.minder-container`, that is, to the same element the site's handler is bound to. This reuses the
site's pan/zoom implementation verbatim: no internal object graphs are reached, no PIXI
display-tree or camera state is touched, and no dependency is introduced on minified identifiers.

Two invariants are required:

1. **Synchrony.** The site records the delta in its handler and applies it on its own ticker. The
   loop emits at most one increment per animation frame, so increments are consumed in order.
2. **Re-entrancy guard.** The extension's listener is capture-phase on `document`, so it also
   observes the synthetic events it emits. Each synthesised event carries an expando
   (`__mubuSynthetic`) and is short-circuited at the top of the listener. The tag is per-event and
   cannot leak across dispatches.

The synthetic path is semantically equivalent to a trusted event for the site's handler: it reads
`deltaX`, `deltaY`, `ctrlKey` and `shiftKey`, all of which are carried by the synthesised object.

### 7.3 Zoom anchor correction under device pixel ratio

For **untrusted** events, Chromium derives `offsetX` / `offsetY` against the target's padding
box in a coordinate space divided by `devicePixelRatio`:

```text
offsetX = clientX / DPR  −  targetOriginX
offsetY = clientY / DPR  −  targetOriginY
```

The site's zoom handler uses these values as the fixed point of the transform, so raw client
coordinates yield an anchor displaced by a constant fraction of the viewport, and the canvas
visibly drifts while zooming. The handler therefore pre-multiplies the coordinates:

```text
clientX' = clientX · DPR ,   clientY' = clientY · DPR
```

which restores `offsetX = clientX − targetOriginX` — the value a trusted event would have produced.
Measured anchor error before correction: (−200, −100) px at (1000, 500) on a DPR-1.25 display;
after correction: 0 px. The pan path needs no correction because it consumes `deltaX` /
`deltaY`, not offsets.

### 7.4 Canvas font substitution

`ctx.font` is a CSS font shorthand of the form
`[style] [variant] [weight] <size>[/<line-height>] <family-list>`. The override installs a property
descriptor on `CanvasRenderingContext2D.prototype`, preserving the native getter and wrapping the
native setter:

1. match the size token and the remainder of the shorthand
   (`/(\d+(?:\.\d+)?(?:px|pt|em|rem|%|vh|vw))(?:\s*\/\s*[^ ]+)?\s+.*$/`);
2. replace the family list with `"<selected>", serif`, retaining size, style and weight;
3. delegate to the native setter.

Family names are quoted and `\`-escaped, so names containing spaces or punctuation are handled.
The override is read at **set time**, so changing the selection takes effect on the next
rasterisation without re-installing the descriptor.

### 7.5 DOM font substitution

A single injected `<style id="mubu-font-override">` carries:

```css
html, body, * { font-family: "<selected>", <fallback chain> !important; }
```

The universal selector is deliberate: `font-family` is inherited, but a declaration on the element
itself outranks an inherited value, and the site assigns concrete families through generated class
names. `!important` outranks those rules without enumerating them.

The fallback chain is the selected family followed by `Noto Serif SC`, `Source Han Serif SC`,
`Songti SC`, `SimSun` and the generic `serif`; duplicates are removed case-insensitively so
that the default selection does not produce a redundant chain.

When the selection is the empty string, the `<style>` element is removed and the setter becomes a
pass-through, so the override is reversible at runtime without reloading the extension.

---

## 8. Configuration Reference

| Symbol | Value | Location |
| --- | --- | --- |
| Storage key | `fontFamily` | `popup.js`, `content-bridge.js` |
| DOM attribute | `data-mubu-font-family` | `content.js`, `content-bridge.js` |
| Cache key | `__mubu_font_family` | `content-bridge.js` |
| Style element id | `mubu-font-override` | `content.js` |
| Default family | `Noto Serif SC` | `content.js`, `content-bridge.js`, `popup.js` |
| Smoothing coefficient | `α = 0.18` | `content.js` |
| Convergence thresholds | `0.5` and `0.05` | `content.js` |
| Re-entrancy tag | `__mubuSynthetic` | `content.js` |
| Idempotency guard | `window.__mubuPatch` | `content.js` |

---

## 9. Design Rationale

| Decision | Alternative rejected | Reason |
| --- | --- | --- |
| Re-dispatch synthetic `wheel` | Mutating camera state directly | The site owns camera state in a PIXI display tree; reaching it requires stable access to internal services, which minified bundles do not guarantee across releases. |
| `world: "MAIN"` content script | Injecting an inline `<script>` | In testing, the page's Content-Security-Policy rejected the injected inline script; it never executed. |
| DOM attribute transport | `CustomEvent` carrying an object payload | Objects created in one realm are remote objects in the other; primitives on a node attribute avoid wrapping and are observable declaratively. |
| `MutationObserver` | `storage.onChanged` inside the main world | Extension APIs are unavailable in the main world; the observer also covers the attribute being restored after an SPA re-render. |
| `!important` on `*` | Enumerating generated class names | Class names are content-hashed and change between releases. |
| `fontSettings.getFontList()` | Local Font Access API | `queryLocalFonts()` requires a user gesture and a per-origin permission prompt on every profile; `fontSettings` is prompt-free and deterministic. |
| Selection as data, not a rebuild | Rebuilding the bundle per font | The selection must be changeable without reinstall and must not depend on the site's bundle hash. |

---

## 10. Constraints and Limitations

- **Outline view is not modified.** Its scrolling keeps native user-agent behaviour; no listener
  is installed for it. The earlier accumulator for that path was removed by request.
- **Canvas text requires a reload.** Glyphs are cached per font string, and the override applies to
  subsequent rasterisations; a refresh or a re-layout is needed to repaint existing labels.
- **Scope of interception.** Wheel handling is taken over only while the pointer is inside
  `.minder-container`. Outside it, Ctrl + wheel performs user-agent page zoom.
- **Installed families only.** A family that is not installed falls through to the fallback chain.
- **No Web Store packaging.** The extension is loaded unpacked; Edge requires developer mode.
- **Per-frame instances.** With `all_frames: true` each frame runs its own instance; the idempotency
  guard is per frame.
- **Not hardened against site redesign.** The selectors depend on `.minder-container` and on the
  canvas and font APIs; renaming the container class would disable smoothing without breaking the
  page.

---

## 11. Troubleshooting

| Symptom | Likely cause | Remedy |
| --- | --- | --- |
| Panel lists no families | `fontSettings` permission revoked | `edge://extensions` → Details → Permissions; re-accept |
| Family saved but page unchanged | Selected family not installed | Verify it renders in the list; try a system family such as `SimSun` |
| DOM text changed, canvas text did not | Glyph cache | Reload the page |
| Override has no visible effect | A higher-specificity rule with `!important` | Report the selector; the override currently uses the universal selector |
| Mind map still stepwise | Pointer outside `.minder-container`, or the container class was renamed | Confirm with the container selector in DevTools |
| Extension disabled after update | New permissions pending | Remove and load unpacked again |

---

## 12. Performance

- One capture-phase listener on `document`; O(1) work per wheel event and no layout reads on the
  input path.
- Emissions are coalesced to one synthetic event per animation frame; the loop terminates within a
  bounded number of frames (threshold-based) and cancels itself on completion.
- The `MutationObserver` is scoped to a single attribute filter, so it fires only on actual
  configuration changes.
- Zero overhead outside the mind-map region: the listener returns after one `elementsFromPoint`
  probe, and that probe is reached only when a container exists.

---

## 13. Security and Privacy

- No network requests are issued by the extension; no analytics and no remote configuration.
- `chrome.fontSettings` is used only for `getFontList()`; no font or system preference is written.
- The only persisted state is the selected family name.
- Main-world code touches two global surfaces: `CanvasRenderingContext2D.prototype.font` and a
  namespaced attribute on `document.documentElement`. Both are additive and reversible.
- Host permissions are limited to `mubu.com` and `imubu.com` and their subdomains.

---

## 14. Repository Layout

```text
mubu.com-customization-extension/
├── manifest.json              MV3 declaration (permissions, two content scripts, popup)
├── content-bridge.js          isolated world: storage → DOM attribute → localStorage mirror
├── content.js                 main world: font overrides + smoothed pan/zoom
├── popup.html, popup.js       configuration UI
├── smooth-scroll.patch.js     verbatim copy of content.js (script-mode payload)
├── mubu_smooth_scroll.mjs     CDP launcher (script mode)
├── README.en.md               this document (English)
└── README.md                  Chinese README
```

---

## 15. Development and Verification

Load the unpacked directory, attach the DevTools Protocol to the target, and evaluate in the page
realm. Useful probes:

```js
// font transport
document.documentElement.getAttribute('data-mubu-font-family');

// effective family on an element
getComputedStyle(document.body).fontFamily;

// confirm the canvas override is installed and effective
(() => {
  const c = document.createElement('canvas').getContext('2d');
  c.font = 'normal 400 16px Arial';
  return c.font;
})();
```

Regression checklist:

1. Wheel over the mind map pans smoothly, and successive events accumulate.
2. Ctrl + wheel zooms about the pointer with no lateral drift.
3. Changing the family updates DOM text immediately.
4. Reloading the page repaints canvas text with the new family.
5. Selecting *Do not override* removes the `<style>` element and turns the setter into a
   pass-through.

---

## 16. Changelog

| Version | Changes |
| --- | --- |
| **1.2.1** | Domain migration: the document host moved from `mubu.com` to `imubu.com` (the application rewrites `mubu.com`/`www.mubu.com` to `imubu.com` and `share.mubu.com`/`mubucm.com` to `share.imubu.com`), so the previous match patterns never applied and neither content script was injected. Both `content_scripts` entries now match `https://imubu.com/*` and `https://*.imubu.com/*` in addition to the legacy patterns; script-mode default URL updated. |
| **1.2.0** | Font selection from locally installed families; search, manual entry and frequently-used chips; duplicate-free fallback chain; `MUBU_FONT` for script mode; the outline scrolling override was removed (mind map only). |
| **1.1.0** | Global font override covering DOM text and canvas text, defaulting to `Noto Serif SC`. |
| **1.0.0** | Accumulative, eased mind-map panning and zooming. |

---

## 17. License

Released under the MIT License.
