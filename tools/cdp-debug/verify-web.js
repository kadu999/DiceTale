// 现代引擎（Chrome/Edge headless）多视口验证遮罩弹框自适应。
// 用法: CDP_PORT=9223 node verify-web.js
const http = require('http');
const WebSocket = require(require('path').join(__dirname, '..', '..', 'backend_tauri2', 'node_modules', 'ws'));

const PORT = process.env.CDP_PORT || '9223';
const VIEWPORTS = [[1280, 800], [800, 600], [375, 667], [600, 260], [1920, 1080]];

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
  const targets = await getJson(`http://127.0.0.1:${PORT}/json`);
  const page = targets.find((t) => t.type === 'page');
  if (!page) throw new Error('no page on ' + PORT + ': ' + JSON.stringify(targets));
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
      const timer = setTimeout(() => { pending.delete(id); resolve({ error: { message: 'timeout ' + method } }); }, 8000);
      pending.set(id, (msg) => { clearTimeout(timer); resolve(msg); });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) return 'EVAL_EXC: ' + JSON.stringify(r.result.exceptionDetails);
    return r.result && r.result.result ? r.result.result.value : JSON.stringify(r.result);
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.reload', { ignoreCache: true });
  await new Promise((r) => setTimeout(r, 2500));

  for (const [w, h] of VIEWPORTS) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
    await new Promise((r) => setTimeout(r, 400));
    await evalJs(`(() => {
      state = { currentMap: 'Map002', spawnPoints: {}, objects: {
        testObj: { id: 'testObj', name: '测试遮罩', kind: 'Object', mapName: 'Map002', position: { x: 0.5, y: 0.5 },
          componentData: [{ component: 'MaskImage', data: JSON.stringify({ maskWidth: 1920, maskHeight: 1080, edgeFeather: 1 }) }] }
      }, players: {} };
      openMaskEditor('testObj');
      return 'opened';
    })()`);
    await new Promise((r) => setTimeout(r, 300));
    const out = await evalJs(`(function(){
      const dlg = document.querySelector('#maskEditorModal .modal-dialog');
      const cvs = document.getElementById('maskCanvas');
      const vw = window.innerWidth, vh = window.innerHeight;
      const d = dlg.getBoundingClientRect();
      const c = cvs.getBoundingClientRect();
      const ins = (r) => r.left >= -0.5 && r.top >= -0.5 && r.right <= vw + 0.5 && r.bottom <= vh + 0.5;
      const ratio = c.width && c.height ? (c.width / c.height).toFixed(3) : 'n/a';
      return JSON.stringify({
        viewport: { w: vw, h: vh },
        dialog: { w: Math.round(d.width), h: Math.round(d.height), l: Math.round(d.left), t: Math.round(d.top), r: Math.round(d.right), b: Math.round(d.bottom) },
        canvas: { w: Math.round(c.width), h: Math.round(c.height), ratio: ratio },
        dialogInViewport: ins(d), canvasInViewport: ins(c), canvasInDialog: c.left >= d.left - 0.5 && c.right <= d.right + 0.5 && c.top >= d.top - 0.5 && c.bottom <= d.bottom + 0.5,
      }, null, 1);
    })()`);
    console.log(`=== ${w}x${h} ===`);
    console.log(out);
    await evalJs(`(() => { if (window.bootstrap) { const m = bootstrap.Modal.getInstance(document.getElementById('maskEditorModal')); if (m) m.hide(); } document.getElementById('maskEditorModal').style.display = 'none'; return 'closed'; })()`);
    await new Promise((r) => setTimeout(r, 200));
  }
  ws.close();
  process.exit(0);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
