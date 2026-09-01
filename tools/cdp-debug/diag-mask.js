// 诊断：headless Chrome 里遮罩弹框尺寸链的 computed style（CDP_PORT 环境变量指定端口）。
const http = require('http');
const WebSocket = require(require('path').join(__dirname, '..', '..', 'backend_tauri2', 'node_modules', 'ws'));

const PORT = process.env.CDP_PORT || '9223';

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

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.reload', { ignoreCache: true });
  await new Promise((r) => setTimeout(r, 2500));

  await evalJs(`(() => {
    state = { currentMap: 'Map002', spawnPoints: {}, objects: {
      testObj: { id: 'testObj', name: '测试', kind: 'Object', mapName: 'Map002', position: { x: 0.5, y: 0.5 },
        componentData: [{ component: 'MaskImage', data: JSON.stringify({ maskWidth: 1920, maskHeight: 1080, edgeFeather: 1 }) }] }
    }, players: {} };
    openMaskEditor('testObj');
    return 'opened';
  })()`);
  await new Promise((r) => setTimeout(r, 500));

  const expr = `(function(){
    const sel = (s) => document.querySelector(s);
    const g = (el, p) => el ? getComputedStyle(el)[p] : null;
    const r = (el) => el ? Object.fromEntries(['left','top','right','bottom','width','height'].map(k => [k, Math.round(el.getBoundingClientRect()[k])])) : null;
    const modal = sel('#maskEditorModal');
    const dlg = sel('#maskEditorModal .modal-dialog');
    const content = sel('#maskEditorModal .modal-content');
    const body = sel('#maskEditorModal .modal-body');
    const ed = sel('.mask-editor-body');
    const cvs = document.getElementById('maskCanvas');
    return JSON.stringify({
      vw: innerWidth, vh: innerHeight, dpr: devicePixelRatio,
      modal: { rect: r(modal), display: g(modal,'display'), overflowY: g(modal,'overflow-y') },
      dlg: { rect: r(dlg), display: g(dlg,'display'), alignItems: g(dlg,'align-items'), minHeight: g(dlg,'min-height'), margin: g(dlg,'margin'), height: g(dlg,'height'), justifyContent: g(dlg,'justify-content') },
      content: { rect: r(content), maxHeight: g(content,'max-height'), height: g(content,'height'), flexDirection: g(content,'flex-direction') },
      body: { rect: r(body), flex: g(body,'flex'), minHeight: g(body,'min-height'), display: g(body,'display') },
      editor: { rect: r(ed), flex: g(ed,'flex'), minHeight: g(ed,'min-height'), display: g(ed,'display') },
      canvas: { rect: r(cvs), maxW: g(cvs,'max-width'), maxH: g(cvs,'max-height'), w: g(cvs,'width'), h: g(cvs,'height'), display: g(cvs,'display') },
    }, null, 1);
  })()`;
  console.log(await evalJs(expr));
  ws.close();
  process.exit(0);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
