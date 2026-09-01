// CDP 调试助手：通过 adb forward 的 WebView 调试端口，对页面执行 JS 并打印结果。
// 用法：
//   node scripts/cdp-eval.js '<js 表达式>'
//   node scripts/cdp-eval.js '<js 表达式>' --console   # 额外收集 3s console 消息/异常
// 前置：adb forward tcp:9222 localabstract:webview_devtools_remote_<app pid> 已执行。
const http = require('http');

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

(async () => {
  const targets = await getJson('http://localhost:9222/json');
  const page = targets.find((t) => t.type === 'page');
  if (!page) {
    console.error('[cdp] 没有 page target（当前 targets: ' + JSON.stringify(targets.map((t) => t.url)) + '）');
    process.exit(1);
  }
  const WebSocket = require('ws');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const expr = process.argv[2];
  const withConsole = process.argv.includes('--console');

  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method === 'Runtime.consoleAPICalled') {
      console.log('[console]', JSON.stringify(msg.params.args.map((a) => (a.value !== undefined ? a.value : a.description))));
    } else if (msg.method === 'Runtime.exceptionThrown') {
      console.log('[exception]', JSON.stringify(msg.params.exceptionDetails && msg.params.exceptionDetails.text));
    } else if (msg.method === 'Log.entryAdded') {
      console.log('[log]', msg.params.entry.level, JSON.stringify(msg.params.entry.text));
    }
  });

  ws.on('open', () => {
    ws.send(JSON.stringify({ id: ++id, method: 'Runtime.enable' }));
    ws.send(JSON.stringify({ id: ++id, method: 'Log.enable' }));
    setTimeout(() => {
      const myId = ++id;
      pending.set(myId, (msg) => {
        const r = msg.result && msg.result.result;
        console.log('RESULT:', JSON.stringify(r && r.value !== undefined ? r.value : r, null, 2));
        setTimeout(() => process.exit(0), withConsole ? 3000 : 400);
      });
      ws.send(JSON.stringify({ id: myId, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: true } }));
    }, 300);
  });
  ws.on('error', (e) => { console.error('[cdp] ws error:', e.message); process.exit(1); });
})();
