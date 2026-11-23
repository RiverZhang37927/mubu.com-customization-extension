#!/usr/bin/env node
// 幕布平滑滚动 - 本地前端补丁脚本 (CDP 注入版)
// Mubu smooth-scroll: launches Edge with remote debugging and injects the
// smooth-scroll patch into every page before its scripts run. Hash-independent:
// 与站点打包文件名/版本号无关，mubu 更新后仍然有效。
//
// 用法 / Usage:
//   node mubu_smooth_scroll.mjs
// 保持本终端窗口开启，在脚本打开的 Edge 窗口中使用幕布即可获得平滑滚动。
//
// 环境变量 / Env:
//   EDGE_PATH    msedge.exe 路径 (默认 C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe)
//   MUBU_PORT    调试端口 (默认 9222)
//   MUBU_URL     打开地址 (默认 https://imubu.com/app)
//   MUBU_PROFILE Edge 用户数据目录 (默认 脚本目录/.edge-profile)
//   MUBU_FONT    字体名称 (默认 Noto Serif SC；设为空字符串则不修改字体)

import { spawn } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PATCH = readFileSync(join(__dirname, 'smooth-scroll.patch.js'), 'utf8');

const PORT = Number(process.env.MUBU_PORT || 9222);
const EDGE = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PROFILE = process.env.MUBU_PROFILE || join(__dirname, '.edge-profile');
const TARGET_URL = process.env.MUBU_URL || 'https://imubu.com/app';
const FONT = process.env.MUBU_FONT === undefined ? 'Noto Serif SC' : process.env.MUBU_FONT;

if (!existsSync(EDGE)) {
  console.error('[!] 找不到 Edge: ' + EDGE);
  console.error('    可用环境变量 EDGE_PATH 指定 msedge.exe 路径');
  process.exit(2);
}
mkdirSync(PROFILE, { recursive: true });

console.log('[mubu-smooth-scroll] 启动 Edge (调试端口 ' + PORT + ')...');
spawn(EDGE, [
  '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + PROFILE,
  '--no-first-run',
  '--no-default-browser-check',
  '--start-maximized',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // wait for CDP
  for (let i = 0; i < 60; i++) {
    try { await fetch('http://127.0.0.1:' + PORT + '/json/version'); break; }
    catch { await sleep(500); }
  }

  // open a fresh tab
  const tab = await (await fetch('http://127.0.0.1:' + PORT + '/json/new?about:blank', { method: 'PUT' })).json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', () => rej(new Error('ws error'))); });

  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const _id = ++id;
    pending.set(_id, { resolve, reject });
    ws.send(JSON.stringify({ id: _id, method, params }));
  });
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id); pending.delete(msg.id);
      msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
    }
  });

  // 注入字体属性（供补丁读取），再注入补丁本身
  const PRELUDE = '(function(){try{document.documentElement.setAttribute("data-mubu-font-family", ' + JSON.stringify(FONT) + ');}catch(e){}})();';
  await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: PRELUDE + '\n' + PATCH });
  console.log('[mubu-smooth-scroll] 已注入补丁（字体: ' + (FONT || '不修改') + '），打开 ' + TARGET_URL + ' ...');
  await send('Page.navigate', { url: TARGET_URL });

  console.log('[mubu-smooth-scroll] 就绪。保持本窗口开启，在 Edge 中使用幕布即可获得平滑滚动。');
  console.log('[mubu-smooth-scroll] 提示：若在此窗口新开标签页，请把新标签页重新定位到该页一次后补丁同样生效。');
  console.log('[mubu-smooth-scroll] Ctrl+C 退出。');
  process.on('SIGINT', () => { console.log('\n[mubu-smooth-scroll] 退出'); process.exit(0); });
  await new Promise(() => {});
}

main().catch((e) => { console.error('[mubu-smooth-scroll] 出错:', e.message); process.exit(1); });
