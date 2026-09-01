// 用 CDP 截取页面区域（CSS px 坐标），存为 PNG。带超时保护。
// 用法: node cdp-shot.js <out.png> [x y w h]  （缺省用 #mapContainer 的 rect）
const http = require('http');
const fs = require('fs');
const WebSocket = require(require('path').join(__dirname, '..', '..', 'backend_tauri2', 'node_modules', 'ws'));

const CDP_HTTP = 'http://127.0.0.1:9222';

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function main() {
  const out = process.argv[2] || 'shot.png';
  const targets = await getJson(CDP_HTTP + '/json');
  const page = targets.find((t) => t.type === 'page');
  if (!page) throw new Error('no page target');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let msgId = 0;
  const pending = new Map();
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });
  await new Promise((res) => ws.on('open', res));
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = ++msgId;
      const timer = setTimeout(() => {
        pending.delete(id);
        resolve({ error: { message: 'timeout waiting ' + method } });
      }, 10000);
      pending.set(id, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      ws.send(JSON.stringify({ id, method, params }));
    });

  let clip;
  if (process.argv[3]) {
    clip = { x: +process.argv[3], y: +process.argv[4], width: +process.argv[5], height: +process.argv[6], scale: 1 };
  } else {
    const r = await send('Runtime.evaluate', {
      expression: `(function(){ const r = document.getElementById('mapContainer').getBoundingClientRect(); return JSON.stringify({x:r.left,y:r.top,width:r.width,height:r.height}); })()`,
      returnByValue: true,
    });
    if (r.error || !r.result || !r.result.result) throw new Error('rect eval failed: ' + JSON.stringify(r));
    clip = JSON.parse(r.result.result.value);
    clip.scale = 1;
  }
  console.error('clip =', JSON.stringify(clip));

  const res = await send('Page.captureScreenshot', { format: 'png', clip, fromSurface: true });
  if (res.error) throw new Error('capture failed: ' + JSON.stringify(res.error));
  if (!res.result || !res.result.data) throw new Error('no data: ' + JSON.stringify(res));
  fs.writeFileSync(out, Buffer.from(res.result.data, 'base64'));
  console.log('saved', out);
  ws.close();
  process.exit(0);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
