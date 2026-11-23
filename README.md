# 幕布网页端平滑滚动/平滑缩放/自选字体 —— Edge 扩展

当前版本：**v1.2.1**

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2EA44F?style=flat-square" alt="License: MIT" /></a>
  <a href="package.json"><img src="https://img.shields.io/badge/Node.js-%3E%3D22-339933?style=flat-square&amp;logo=nodedotjs&amp;logoColor=white" alt="Node.js >=22" /></a>
</p>
<p align="center"><a href="README.en.md">English</a> · 中文</p>
<p align="center">Latest Release · <a href="README.1.0.0.zh.md">Font Default Release</a>  </p>

## 开发动机

幕布网页端与 Win / macOS 桌面端的滚动、放缩动作偏卡顿，体验甚至不如 Android / iOS APP。

扩展在浏览器层面为 mubu.com / imubu.com 补上「累加 + 缓动」的滚动 / 平移 / 缩放，并支持把界面字体换成**本机已安装的任意字体**。

## 功能实现

在 Edge 中打开 mubu.com 或 imubu.com（含所有子域名）时生效。幕布已把主域名迁到 imubu.com，扩展同时匹配新旧域名。

### 1. 思维导图模式

- **滚轮平移画布**：累加 + 缓动 —— 连续滚多下会累加位移，并平滑过渡（不会"多下只滚一下"）
- **Ctrl / ⌘ + 滚轮缩放**：累加 + 缓动 —— 缩放中心精确跟随光标

### 2. 全局字体（可自选）

点击工具栏上的扩展图标，即可打开字体面板：

- 自动列出**本机已安装的全部字体**（实测约 229 个，含中文名：宋体 / 楷体 / 微软雅黑 / 华文楷体 等）
- 支持**搜索过滤**（如输入「宋体」「思源」「Noto」）与**手动输入**任意字体名
- 「常用字体」一键切换
- 选择「**（不修改字体 / 幕布默认）**」即关闭字体覆盖，恢复幕布原生字体
- 选择会**实时应用**到已打开的幕布标签页，并记住到下次打开

字体覆盖范围：

- 页面 DOM 文本与 UI（大纲、侧边栏、按钮、菜单等）
- **思维导图画布文字**（通过 patch `CanvasRenderingContext2D.font` 实现）
- 提示：画布文字在**刷新页面后完全生效**

默认字体为 **Noto Serif SC**（需本机已安装；未安装时自动回退到 Source Han Serif SC / 宋体 / serif）。

### 3. 明确未修改的部分

- **大纲页的滚动**：保持浏览器原生行为，本扩展不介入
- **非思维导图区域的 Ctrl + 滚轮**：仍是浏览器页面缩放

## 安装

### 不折腾方案：Edge 解压扩展（推荐）

1. 点击code下载整个项目的源代码.zip
2. 打开 Edge，地址栏输入 `edge://extensions`
3. 打开左下角的 **开发人员模式**
4. 点击 **加载解压缩的扩展**
5. 选择本仓库中包含 `manifest.json` 的扩展文件夹
6. 打开或刷新 mubu.com / imubu.com 任意页面
7. 点击插件栏中出现的扩招图标 → 选择想要的字体

说明：

- 本扩展申请两项权限：
  - `storage` —— 保存字体选择
  - `fontSettings` —— 读取已安装字体列表（Edge 会提示「读取和更改字体设置」，本扩展**只读取，不修改系统字体**）
- 从旧版本升级：文件夹名与权限有变化，建议先在 `edge://extensions` **移除旧扩展**，再重新「加载解压缩的扩展」。
- **v1.2.1 起 manifest 增加了 imubu.com 匹配**：升级后必须在 `edge://extensions` 对本扩展点一次「重新加载」，再刷新页面；否则仍在运行旧的匹配规则。

### 极客方案：Node.js 脚本（不装扩展，需保持脚本运行）

要求本机已安装 Node.js：

```bash
node mubu_smooth_scroll.mjs
```

脚本会启动一个带调试端口的 Edge 并注入补丁；保持终端窗口开启，`Ctrl+C` 退出。

| 变量 | 含义 | 默认值 |
| --- | --- | --- |
| EDGE_PATH | msedge.exe 完整路径 | `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` |
| MUBU_URL | 打开地址 | `https://imubu.com/app` |
| MUBU_PORT | 调试端口 | `9222` |
| MUBU_FONT | 字体名称（设为空字符串 = 不修改字体） | `Noto Serif SC` |

## 使用字体面板

| 操作 | 说明 |
| --- | --- |
| 在列表中点选 | 自动填入输入框 |
| 顶部搜索框 | 过滤字体列表 |
| 手动输入 | 支持列表未显示的字体名 |
| 保存并应用 | 写入扩展存储；已打开的幕布页面立即更新 |
| 刷新页面 | 重新加载当前标签页（画布文字建议刷新一次） |

## 实现原理

| 文件 | 运行环境 | 作用 |
| --- | --- | --- |
| `content-bridge.js` | 隔离世界（ISOLATED） | 读取 `chrome.storage.sync` 中的字体选择，写入 `<html data-mubu-font-family>`，并监听变化实时同步；同时把选择缓存进页面 `localStorage`，使页面重载后首屏即带字体 |
| `content.js` | 主世界（`world: "MAIN"`） | 监听该属性 → 注入 `font-family` CSS（DOM 文本）+ patch `CanvasRenderingContext2D.prototype.font`（画布文字）；并实现思维导图平移 / 缩放的累加缓动 |
| `popup.html` / `popup.js` | 扩展弹窗 | 通过 `chrome.fontSettings.getFontList()` 枚举字体、保存选择 |
| `smooth-scroll.patch.js` | — | 与 `content.js` 内容一致，供方案 B 读取 |

关键技术点：

1. **为什么字体要拆成两个脚本**：patch 画布字体必须运行在 `world: "MAIN"`，但主世界拿不到 `chrome.*` API。因此用 `<html data-mubu-font-family>` 属性作为跨世界通道（DOM 在两个世界间共享）。
2. **为什么不再注入 `<script>`**：早期版本靠注入内联脚本进入主世界，会被页面 CSP 拦截；改用 `world: "MAIN"` 后无需注入。
3. **画布文字**：思维导图文字由 `CanvasRenderingContext2D` 绘制，`ctx.font` 形如 `normal 400 16px "Helvetica Neue", ...`；补丁在 setter 中把「字号之后」的字族整体替换为目标字体。
4. **思维导图平移 / 缩放**：画布没有 DOM 滚动容器，因此拦截 `wheel` 后，把缓动后的增量以**合成 `wheel` 事件**重新派发给 `.minder-container`，复用其原生平移 / 缩放逻辑（不依赖站点打包哈希）。
5. **缩放中心修正**：合成事件的 `offsetX/offsetY` 会被 Chrome 按 `1 / devicePixelRatio` 缩放，故重派发时把 `clientX/clientY` 乘回 `devicePixelRatio`，使缩放中心精确跟随光标。

## 文件说明

| 文件 | 说明 |
| --- | --- |
| `manifest.json` | 扩展清单（Manifest V3，声明 `storage` / `fontSettings` 权限） |
| `content-bridge.js` | 设置桥接（隔离世界） |
| `content.js` | 主世界补丁：字体 + 平滑平移 / 缩放 |
| `popup.html` / `popup.js` | 字体选择面板 |
| `smooth-scroll.patch.js` | 补丁副本（与 `content.js` 一致，供 Node 脚本读取） |
| `mubu_smooth_scroll.mjs` | 方案 B 启动脚本 |

## 常见问题

**Q：幕布官网打不开？**
- 尝试中国大陆/中国香港IP

**Q：字体没生效？**

- 确认所选字体确实已安装（面板里能搜到）
- 刷新页面；思维导图画布文字必须刷新后才完全生效
- 若幕布自身开启了「自定义字体」，本扩展用 `!important` 优先；如需幕布自己的设置，请在面板选「不修改字体」

**Q：面板里字体列表为空？**

- 检查扩展权限是否被收回（`edge://extensions` → 详情 → 权限）
- 也可在输入框直接手填字体名

**Q：思维导图没有变平滑？**

- 确认地址是 `mubu.com` 或 `imubu.com`：幕布已把主域名迁到 imubu.com，v1.2.0 及更早版本只匹配 mubu.com，迁移后不会注入
- 升级到 v1.2.1 后，在 `edge://extensions` 点一次「重新加载」，再刷新页面
- 本扩展仅在指针位于思维导图画布（`.minder-container`）内时接管滚轮

**Q：会影响其他网站吗？**

- 不会，扩展只匹配以下 4 条规则中的域名：
  - `https://mubu.com/*`、`https://*.mubu.com/*`
  - `https://imubu.com/*`、`https://*.imubu.com/*`

## 更新记录

- **v1.2.1**：适配幕布主域名迁移到 imubu.com —— `manifest.json` 两个内容脚本各增加 `https://imubu.com/*` 与 `https://*.imubu.com/*`（迁移后原匹配不再命中，字体与平滑会同时失效）；Node 脚本默认地址同步为 `https://imubu.com/app`
- **v1.2.0**：字体改为可在弹窗内从**本机已安装字体**中选择；新增字体搜索 / 手动输入 / 常用字体；修复字体栈重复；Node 脚本新增 `MUBU_FONT`
- **v1.0.0**：思维导图平移 / 缩放平滑化 / 默认全局字体为Noto Serif SC

## 展望

1. 欢迎添加 branch 以适配 XMind 等其他主流思维导图页面
2. 欢迎添加 branch 以适配 Google Chrome 等其他浏览器
