// 调试 fitMaskCanvas：手动调用并读取测量值。用法: CDP_PORT=9223 node diag-fit.js
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
        componentData: [{ component: 'MaskImage', data: JSON.stringify({ maskWidth: 1920, maskHeight: 1080, edgeFeather: 1 }) }] }
    }, players: {} };
    openMaskEditor('testObj');
    return 'opened';
  })()`);
  await new Promise((r) => setTimeout(r, 1000));

  console.log('--- 打开后（fit 应已运行）---');
  console.log(await evalJs(`(function(){
    const cvs = document.getElementById('maskCanvas');
    const body = document.querySelector('.mask-editor-body');
    const cs = getComputedStyle(body);
    return JSON.stringify({
      fitExists: typeof fitMaskCanvas,
      canvasStyleW: cvs.style.width, canvasStyleH: cvs.style.height,
      bodyClient: { w: body.clientWidth, h: body.clientHeight },
      bodyPad: { l: cs.paddingLeft, t: cs.paddingTop },
      canvasRect: (function(){ const r = cvs.getBoundingClientRect(); return { w: r.width, h: r.height, b: r.bottom, t: r.top }; })(),
      vh: window.innerHeight,
    }, null, 1);
  })()`));

  console.log('--- 手动再调 fitMaskCanvas ---');
  console.log(await evalJs(`(function(){
    fitMaskCanvas();
    const cvs = document.getElementById('maskCanvas');
    const r = cvs.getBoundingClientRect();
    return JSON.stringify({ styleW: cvs.style.width, styleH: cvs.style.height, rect: { w: r.width, h: r.height, t: r.top, b: r.bottom }, vh: window.innerHeight }, null, 1);
  })()`));
  ws.close();
  process.exit(0);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
