// 快速验证：1420 后端 + backend_tauri2 前端（Bootstrap 5）在浏览器渲染与连接。
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require(path.join(__dirname, '..', 'backend', 'node_modules', 'ws'));

const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PAGE = 'file:///' + path.join(__dirname, '..', 'backend_tauri2', 'src', 'index.html').replace(/\\/g, '/');
const PORT = 9240;

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.p = new Map(); }
  static async connect(url) {
    const ws = new WebSocket(url, { perMessageDeflate: false });
    await new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });
    const c = new CDP(ws);
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.id && c.p.has(m.id)) {
        const { resolve, reject } = c.p.get(m.id);
        c.p.delete(m.id);
        m.error ? reject(new Error(m.error.message)) : resolve(m.result);
      }
    });
    return c;
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.p.set(id, { resolve, reject }));
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('eval error: ' + JSON.stringify(r.exceptionDetails.exception && r.exceptionDetails.exception.description));
    return r.result && r.result.value;
  }
}
async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  console.log('launching chrome...');
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions', '--allow-file-access-from-files',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(__dirname, '.chrome-profile-port'),
    'about:blank',
  ], { stdio: 'ignore' });
  try {
    let targets = null;
    for (let i = 0; i < 50; i++) {
      try { targets = await getJson(`http://127.0.0.1:${PORT}/json`); break; } catch (e) { await sleep(200); }
    }
    if (!targets) throw new Error('chrome debug port not ready');
    console.log('chrome targets:', targets.length);
    const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
    const page = await CDP.connect(pageTarget.webSocketDebuggerUrl);
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Page.navigate', { url: PAGE });
    await sleep(3000);
    console.log('page loaded, title:', await page.eval('document.title'));
    console.log('backendBase:', await page.eval('backendBase'));
    console.log('isTauri:', await page.eval('isTauri()'));
    const r = await page.eval(`(function(){
      setBackendBase('http://localhost:1420');
      return 'setBase ok: ' + backendBase;
    })()`);
    console.log(r);
    // 触发 items.json 加载（改地址后 applyBackendUrl 会重拉，这里手动调）
    await page.eval(`(function(){
      state = { currentMap: 'Map001', spawnPoints: { Map001: { x: 0.5, y: 0.5 } },
        objects: { obj_door: { name: '大门', kind: 'SceneObject', mapName: 'Map001', position: { x: 0.2, y: 0.3 },
          componentData: [ { component: 'OptionValue', displayName: '状态', data: JSON.stringify({ options: ['关','开'], currentOption: '关' }) },
            { component: 'Backpack', displayName: '物品', data: JSON.stringify({ items: [] }) } ] } },
        players: { p1: { name: '战士', mapName: 'Map001', position: { x: 0.5, y: 0.5 } } } };
      selectedObjectId = 'obj_door';
      render();
      return 'rendered';
    })()`);
    await sleep(3000);
    console.log('mapImageLoaded:', await page.eval(`(function(){ const i = document.getElementById('mapImage'); return i && i.complete && i.naturalWidth > 0; })()`));
    console.log('markers:', await page.eval(`document.querySelectorAll('#overlayLayer .object-marker').length`));
    console.log('mapTabs:', await page.eval(`document.querySelectorAll('#mapTabs button').length`));
    console.log('itemCatalog:', await page.eval(`itemCatalog.length`));
    console.log('picker:', await page.eval(`(function(){ openItemPicker('obj_door'); const m = document.getElementById('itemPickerModal'); return m.classList.contains('show'); })()`));
    await sleep(1000);
    console.log('pickerRows:', await page.eval(`document.querySelectorAll('#pickerList .item-row').length`));
  } finally {
    try { chrome.kill(); } catch (e) {}
    process.exit(0);
  }
}
main().catch((e) => { console.error('FAIL:', e); process.exit(1); });
