// 真机验证遮罩弹框自适应：清掉模拟、刷新、打开弹框、测量包含关系。
const http = require('http');
const WebSocket = require(require('path').join(__dirname, '..', '..', 'backend_tauri2', 'node_modules', 'ws'));

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
  const targets = await getJson('http://127.0.0.1:9222/json');
  const page = targets.find((t) => t.type === 'page');
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

  await send('Emulation.clearDeviceMetricsOverride').catch(() => {});
  await send('Page.enable');
  await send('Page.reload', { ignoreCache: true });
  await new Promise((r) => setTimeout(r, 3000));

  const openExpr = `(() => {
    state = { currentMap: 'Map002', spawnPoints: {}, objects: {
      testObj: { id: 'testObj', name: '测试遮罩', kind: 'Object', mapName: 'Map002', position: { x: 0.5, y: 0.5 },
        componentData: [{ component: 'MaskImage', data: JSON.stringify({ maskWidth: 1920, maskHeight: 1080, edgeFeather: 1 }) }] }
    }, players: {} };
    openMaskEditor('testObj');
    return document.getElementById('maskEditorTitle').textContent;
  })()`;
  console.log('open result:', await evalJs(openExpr));
  await new Promise((r) => setTimeout(r, 800));

  const measureExpr = `(function(){
    const dlg = document.querySelector('#maskEditorModal .modal-dialog');
    const cvs = document.getElementById('maskCanvas');
    const modal = document.getElementById('maskEditorModal');
    const vw = window.innerWidth, vh = window.innerHeight;
    const d = dlg.getBoundingClientRect();
    const c = cvs.getBoundingClientRect();
    const ins = (r) => r.left >= -0.5 && r.top >= -0.5 && r.right <= vw + 0.5 && r.bottom <= vh + 0.5;
    return JSON.stringify({
      viewport: { w: vw, h: vh, dpr: window.devicePixelRatio, modalDisplay: getComputedStyle(modal).display },
      dialog: { l: Math.round(d.left), t: Math.round(d.top), r: Math.round(d.right), b: Math.round(d.bottom), w: Math.round(d.width), h: Math.round(d.height) },
      canvas: { l: Math.round(c.left), t: Math.round(c.top), r: Math.round(c.right), b: Math.round(c.bottom), w: Math.round(c.width), h: Math.round(c.height) },
      dialogInViewport: ins(d),
      canvasInViewport: ins(c),
      canvasInDialog: c.left >= d.left - 0.5 && c.right <= d.right + 0.5 && c.top >= d.top - 0.5 && c.bottom <= d.bottom + 0.5,
    }, null, 1);
  })()`;
  console.log('=== 真机（不模拟）===');
  console.log(await evalJs(measureExpr));

  await evalJs(`(() => { if (window.bootstrap) { const m = bootstrap.Modal.getInstance(document.getElementById('maskEditorModal')); if (m) m.hide(); } document.getElementById('maskEditorModal').style.display = 'none'; delete state; return 'cleaned'; })()`);
  ws.close();
  process.exit(0);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
