// 一次性验证：刷新手机页面，检查遮罩弹框结构（描述/滑块已移除）与加载异常。
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
  const exceptions = [];
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      exceptions.push(d.exception ? d.exception.description : d.text);
    } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      exceptions.push(msg.params.entry.text);
    }
  });
  await new Promise((res) => ws.on('open', res));
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = ++msgId;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });

  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Page.reload', { ignoreCache: true });
  await new Promise((res) => setTimeout(res, 3000));

  const r = await send('Runtime.evaluate', {
    expression: `(function(){
      const modal = document.getElementById('maskEditorModal');
      const canvas = document.getElementById('maskCanvas');
      return JSON.stringify({
        readyState: document.readyState,
        modalExists: !!modal,
        descriptionRemoved: modal ? !modal.querySelector('.modal-body > .small.text-secondary') : 'n/a',
        sliderRemoved: modal ? !document.getElementById('maskSoftnessSlider') && !document.getElementById('maskSoftnessValue') : 'n/a',
        canvasExists: !!canvas,
        modalBodyHtml: modal ? modal.querySelector('.modal-body').innerHTML.replace(/\\s+/g, ' ').trim() : null,
      }, null, 1);
    })()`,
    returnByValue: true,
  });
  console.log(String(r.result && r.result.result ? r.result.result.value : JSON.stringify(r.result)));
  console.log('EXCEPTIONS:', exceptions.length ? JSON.stringify(exceptions, null, 1) : 'none');
  ws.close();
  process.exit(0);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
