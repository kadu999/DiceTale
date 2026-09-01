// 验证：遮罩弹框画布显示比例 = 地图背景图比例；模拟非 16:9 地图时仍按地图比例显示且不超屏。
const http = require('http');
const WebSocket = require(require('path').join(__dirname, '..', '..', 'backend_tauri2', 'node_modules', 'ws'));

const PORT = process.env.CDP_PORT || '9222';

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

const MEASURE = `(function(){
  const cvs = document.getElementById('maskCanvas');
  const dlg = document.querySelector('#maskEditorModal .modal-dialog');
  const r = cvs.getBoundingClientRect();
  const d = dlg.getBoundingClientRect();
  const vw = innerWidth, vh = innerHeight;
  return JSON.stringify({
    maskMapAspect: maskMapAspect,
    canvasAttrRatio: (cvs.width / cvs.height).toFixed(4),
    canvasDisplayRatio: (r.width / r.height).toFixed(4),
    canvasDisplay: Math.round(r.width) + 'x' + Math.round(r.height),
    canvasInViewport: r.left >= 0 && r.top >= 0 && r.right <= vw && r.bottom <= vh,
    canvasInDialog: r.left >= d.left - 0.5 && r.right <= d.right + 0.5 && r.top >= d.top - 0.5 && r.bottom <= d.bottom + 0.5,
    viewport: vw + 'x' + vh,
  }, null, 1);
})()`;

async function main() {
  const targets = await getJson(`http://127.0.0.1:${PORT}/json`);
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
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return r.result && r.result.result ? r.result.result.value : JSON.stringify(r.result);
  };

  await send('Page.enable');
  await send('Page.reload', { ignoreCache: true });
  await new Promise((r) => setTimeout(r, 3000));
  await evalJs(`(() => {
    state = { currentMap: 'Map002', spawnPoints: {}, objects: {
      testObj: { id: 'testObj', name: '测试', kind: 'Object', mapName: 'Map002', position: { x: 0.5, y: 0.5 },
        componentData: [{ component: 'MaskImage', data: JSON.stringify({ maskWidth: 960, maskHeight: 540, edgeFeather: 1 }) }] }
    }, players: {} };
    openMaskEditor('testObj');
    return 'opened';
  })()`);
  await new Promise((r) => setTimeout(r, 900));

  console.log('--- 打开后（地图比例 16:9，1920x1080）---');
  console.log(await evalJs(MEASURE));

  await evalJs(`maskMapAspect = 9 / 16; fitMaskCanvas(); 'set'`);
  await new Promise((r) => setTimeout(r, 100));
  console.log('--- 模拟地图竖屏 9:16 后重算 ---');
  console.log(await evalJs(MEASURE));

  await evalJs(`maskMapAspect = 1; fitMaskCanvas(); 'set'`);
  await new Promise((r) => setTimeout(r, 100));
  console.log('--- 模拟地图方形 1:1 后重算 ---');
  console.log(await evalJs(MEASURE));

  ws.close();
  process.exit(0);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
