// 娣卞叆妫€鏌ュ脊妗嗙姸鎬佷笌閬撳叿鍒楄〃鍔犺浇銆?const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require(path.join(__dirname, '..', 'backend', 'node_modules', 'ws'));

const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PAGE = 'file:///' + path.join(__dirname, '..', 'backend_tauri2', 'src', 'index.html').replace(/\\/g, '/');
const PORT = 9225;

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
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions', '--allow-file-access-from-files',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(__dirname, '.chrome-test-profile'),
    'about:blank',
  ], { stdio: 'ignore' });
  try {
    let targets = null;
    for (let i = 0; i < 50; i++) {
      try { targets = await getJson(`http://127.0.0.1:${PORT}/json`); break; } catch (e) { await sleep(200); }
    }
    const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
    const page = await CDP.connect(pageTarget.webSocketDebuggerUrl);
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await page.send('Page.navigate', { url: PAGE });
    await sleep(3000);

    await page.eval(`(function(){
      setBackendBase('http://localhost:1420');
      state = { currentMap: 'Map001', spawnPoints: { Map001: { x: 0.5, y: 0.5 } },
        objects: { obj_door: { name: '澶ч棬', kind: 'SceneObject', mapName: 'Map001', position: { x: 0.2, y: 0.3 },
          componentData: [ { component: 'OptionValue', displayName: '鐘舵€?, data: JSON.stringify({ options: ['鍏?,'寮€'], currentOption: '鍏? }) },
            { component: 'Backpack', displayName: '鐗╁搧', data: JSON.stringify({ items: [] }) } ] } },
        players: { p1: { name: '鎴樺＋', mapName: 'Map001', position: { x: 0.5, y: 0.5 } } } };
      selectedObjectId = 'obj_door';
      render();
      return 'ok';
    })()`);
    await sleep(2000);

    // 閬撳叿鐩綍鏄惁鍔犺浇锛坒etch 璺ㄥ煙 file:// 鍦烘櫙锛?    console.log('itemCatalog len:', await page.eval(`itemCatalog.length`));
    console.log('backendBase:', await page.eval(`backendBase`));

    // 鎵撳紑寮规锛岀瓑杩囨浮瀹屾垚
    await page.eval(`openItemPicker('obj_door')`);
    await sleep(1200);
    console.log('picker state:', await page.eval(`(function(){
      const m = document.getElementById('itemPickerModal');
      const content = m.querySelector('.modal-content');
      const list = document.getElementById('pickerList');
      const cs = getComputedStyle(m);
      return JSON.stringify({
        display: cs.display, visibility: cs.visibility, opacity: cs.opacity,
        showClass: m.classList.contains('show'),
        contentW: content.getBoundingClientRect().width,
        listChildren: list.children.length,
        bodyScrollH: list.scrollHeight, bodyClientH: list.clientHeight,
      });
    })()`));

    await page.eval(`closeItemPicker()`);
    await sleep(600);
    await page.eval(`(function(){ state.objects.obj_mask = { name: '杩烽浘', kind: 'Mask', mapName: 'Map001', position: { x: 0.5, y: 0.5 }, componentData: [{ component: 'MaskImage', displayName: '閬僵', data: JSON.stringify({ maskWidth: 1920, maskHeight: 1080 }) }] }; openMaskEditor('obj_mask'); return 'ok'; })()`);
    await sleep(1200);
    console.log('mask state:', await page.eval(`(function(){
      const m = document.getElementById('maskEditorModal');
      const cs = getComputedStyle(m);
      return JSON.stringify({ display: cs.display, showClass: m.classList.contains('show'), canvas: document.getElementById('maskCanvas').getBoundingClientRect().width });
    })()`));
  } finally {
    try { chrome.kill(); } catch (e) {}
    process.exit(0);
  }
}
main().catch((e) => { console.error('FAIL:', e); process.exit(1); });

