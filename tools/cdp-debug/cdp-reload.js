// 通过 CDP 刷新页面，等待加载完成后可选执行一段 JS。
const http = require('http');
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
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });

  await send('Page.enable');
  const r = await send('Page.reload', { ignoreCache: true });
  console.log('reload sent:', r.error ? JSON.stringify(r.error) : 'ok');

  // 等待 3.5s 让页面加载
  await new Promise((res) => setTimeout(res, 3500));

  const evalR = await send('Runtime.evaluate', {
    expression: `(function(){
      const el = document.getElementById('mapContainer');
      const img = document.getElementById('mapImage');
      const cs = el ? getComputedStyle(el) : null;
      const ics = img ? getComputedStyle(img) : null;
      return JSON.stringify({
        readyState: document.readyState,
        containerClient: el ? { w: el.clientWidth, h: el.clientHeight } : null,
        containerOffset: el ? { w: el.offsetWidth, h: el.offsetHeight } : null,
        containerHeightCss: cs ? cs.height : null,
        img: img ? { complete: img.complete, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, cssH: ics ? ics.height : null } : null,
        viewport: { w: innerWidth, h: innerHeight },
      }, null, 1);
    })()`,
    returnByValue: true,
  });
  console.log(String(evalR.result && evalR.result.result ? evalR.result.result.value : JSON.stringify(evalR.result)));
  ws.close();
  process.exit(0);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
