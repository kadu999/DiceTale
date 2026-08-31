// verify backend_tauri2 frontend (Bootstrap 5) in browser. backend on 1420.
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require(path.join(__dirname, '..', 'backend', 'node_modules', 'ws'));

const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PAGE = 'file:///' + path.join(__dirname, '..', 'backend_tauri2', 'src', 'index.html').replace(/\\/g, '/');
const PORT = 9231;

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

const INJECT = `(function () {
  // 榛樿 file:// 涓?backendBase 鍥為€€ localhost:1420锛岃繖閲屾樉寮忚缃?  setBackendBase('http://localhost:1420');
  state = {
    currentMap: 'Map001',
    spawnPoints: { Map001: { x: 0.5, y: 0.5 } },
    objects: {
      obj_door: { name: '澶ч棬', kind: 'SceneObject', mapName: 'Map001', position: { x: 0.2, y: 0.3 },
        componentData: [
          { component: 'OptionValue', displayName: '鐘舵€?, data: JSON.stringify({ options: ['鍏?, '寮€'], currentOption: '鍏? }) },
          { component: 'Backpack', displayName: '鐗╁搧', data: JSON.stringify({ items: ['鑽夎嵂', '鑽夎嵂'] }) },
        ] },
      obj_box: { name: '瀹濈', kind: 'SceneObject', mapName: 'Map001', position: { x: 0.7, y: 0.65 },
        componentData: [
          { component: 'OptionValue', displayName: '鐘舵€?, data: JSON.stringify({ options: ['閿?, '寮€'], currentOption: '閿? }) },
        ] },
      obj_mask: { name: '杩烽浘', kind: 'Mask', mapName: 'Map001', position: { x: 0.5, y: 0.5 },
        componentData: [{ component: 'MaskImage', displayName: '閬僵', data: JSON.stringify({ maskWidth: 1920, maskHeight: 1080 }) }] },
    },
    players: { p1: { name: '鎴樺＋', mapName: 'Map001', position: { x: 0.5, y: 0.5 } } },
  };
  selectedObjectId = 'obj_door';
  render();
  return 'injected';
})()`;

const CHECK = `(function () {
  const q = (s) => { const e = document.querySelector(s); return e ? true : false; };
  const rect = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), visible: r.width > 0 && r.height > 0 }; };
  return JSON.stringify({
    bootstrapLoaded: typeof window.bootstrap !== 'undefined',
    mapImageLoaded: (function(){ const i = document.getElementById('mapImage'); return i && i.complete && i.naturalWidth > 0; })(),
    markers: document.querySelectorAll('#overlayLayer .object-marker').length,
    playerMarkers: document.querySelectorAll('#playerLayer .player-marker').length,
    mapTabs: document.querySelectorAll('#mapTabs button').length,
    propertyRows: document.querySelectorAll('#propertyListMap .property-row').length,
    mapContainer: rect('#mapContainer'),
    statusBadges: document.querySelectorAll('#clientStatus, #connectionStatus').length,
    settingsBtn: q('button[onclick="openSettings()"]'),
    pageTabs: document.querySelectorAll('.page-tab').length,
  });
})()`;

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
    console.log('inject:', await page.eval(INJECT));
    await sleep(2500); // 绛夊湴鍥惧浘鐗?+ items.json
    console.log('CHECK:', await page.eval(CHECK));

    // 寮规娴嬭瘯锛氶亾鍏烽€夋嫨
    console.log('openPicker:', await page.eval(`(function(){ openItemPicker('obj_door'); const m = document.getElementById('itemPickerModal'); return m.classList.contains('show'); })()`));
    await sleep(600);
    console.log('pickerRows:', await page.eval(`document.querySelectorAll('#pickerList .item-row').length`));
    console.log('pickerVisible:', await page.eval(`(function(){ const r = document.querySelector('#itemPickerModal .modal-content').getBoundingClientRect(); return r.width > 0 && r.height > 0; })()`));
    await page.eval(`closeItemPicker()`);
    // 閬僵寮规
    console.log('openMask:', await page.eval(`(function(){ openMaskEditor('obj_mask'); const m = document.getElementById('maskEditorModal'); return m.classList.contains('show'); })()`));
    await sleep(400);
    console.log('maskCanvas:', await page.eval(`(function(){ const c = document.getElementById('maskCanvas'); const r = c.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; })()`));
  } finally {
    try { chrome.kill(); } catch (e) {}
    process.exit(0);
  }
}
main().catch((e) => { console.error('FAIL:', e); process.exit(1); });


