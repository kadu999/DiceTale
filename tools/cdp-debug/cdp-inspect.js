// CDP 调试助手：连接 Android WebView 的 devtools 端口，执行 JS 检查页面状态。
// 用法: node cdp-inspect.js [evaluate-expr-file-or-inline]
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
  if (!page) throw new Error('no page target: ' + JSON.stringify(targets));

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let msgId = 0;
  const pending = new Map();

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method === 'Runtime.consoleAPICalled') {
      const args = (msg.params.args || []).map((a) => a.value !== undefined ? a.value : a.description).join(' ');
      console.log('[console.' + msg.params.type + ']', args);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      console.log('[exception]', JSON.stringify(msg.params.exceptionDetails));
    } else if (msg.method === 'Log.entryAdded') {
      console.log('[log.' + msg.params.entry.level + ']', msg.params.entry.text);
    }
  });

  await new Promise((res) => ws.on('open', res));
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = ++msgId;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });

  // 捕获页面 console/异常
  await send('Runtime.enable');
  await send('Log.enable');

  const expr = process.argv[2]
    ? require('fs').readFileSync(process.argv[2], 'utf-8')
    : `(function(){
      const img = document.getElementById('mapImage');
      const container = document.getElementById('mapContainer');
      const tabs = document.getElementById('mapTabs');
      const conn = document.getElementById('connectionStatus');
      const client = document.getElementById('clientStatus');
      const info = {
        url: location.href,
        readyState: document.readyState,
        stateDefined: typeof state !== 'undefined',
        state: typeof state !== 'undefined' ? {
          currentMap: state.currentMap,
          spawnPoints: state.spawnPoints ? Object.keys(state.spawnPoints) : null,
          objects: state.objects ? Object.keys(state.objects).length : 0,
          players: state.players ? Object.keys(state.players).length : 0,
          clientConnected: state.clientConnected,
        } : null,
        apiMaps: typeof apiMaps !== 'undefined' ? apiMaps : null,
        selectedMap: typeof selectedMap !== 'undefined' ? selectedMap : null,
        img: img ? {
          src: img.src,
          complete: img.complete,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          currentSrc: img.currentSrc,
          hasAttr: img.hasAttribute('src'),
        } : null,
        container: container ? { w: container.clientWidth, h: container.clientHeight } : null,
        tabs: tabs ? tabs.innerText : null,
        connText: conn ? conn.textContent : null,
        clientText: client ? client.textContent : null,
        pageMapVisible: !!document.getElementById('pageMap') && getComputedStyle(document.getElementById('pageMap')).display,
      };
      return JSON.stringify(info, null, 1);
    })()`;

  const r = await send('Runtime.evaluate', {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.result && r.result.exceptionDetails) {
    console.log('EVAL EXCEPTION:', JSON.stringify(r.result.exceptionDetails, null, 1));
  } else {
    console.log(String(r.result && r.result.result ? r.result.result.value : JSON.stringify(r.result)));
  }
  ws.close();
  process.exit(0);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
