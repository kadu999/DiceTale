// 验证遮罩弹框标题栏下边框已移除。
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
        componentData: [{ component: 'MaskImage', data: JSON.stringify({ maskWidth: 1920, maskHeight: 1080 }) }] }
    }, players: {} };
    openMaskEditor('testObj');
    return 'opened';
  })()`);
  await new Promise((r) => setTimeout(r, 800));
  console.log(await evalJs(`(function(){
    const h = document.querySelector('#maskEditorModal .modal-header');
    return JSON.stringify({
      borderBottom: h ? getComputedStyle(h).borderBottom : 'no header',
      modalDisplay: getComputedStyle(document.getElementById('maskEditorModal')).display,
    }, null, 1);
  })()`));
  ws.close();
  process.exit(0);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
