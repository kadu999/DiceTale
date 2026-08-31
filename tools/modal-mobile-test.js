// 妫€鏌ラ亾鍏烽€夋嫨寮规鍦ㄦ墜鏈烘í灞忓昂瀵镐笅鐨勫唴閮ㄥ竷灞€锛堟槸鍚︽孩鍑?鎸夐挳鏄惁鍦ㄥ睆骞曞唴锛夈€?const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require(path.join(__dirname, '..', 'backend', 'node_modules', 'ws'));

const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PAGE_URL = process.env.PAGE_URL || 'http://localhost:1420/';
const PORT = 9223;

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
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true });
    if (r.exceptionDetails) throw new Error('eval error: ' + JSON.stringify(r.exceptionDetails.exception && r.exceptionDetails.exception.description));
    return r.result && r.result.value;
  }
}
async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

const INJECT_STATE = `(function () {
  state = {
    currentMap: 'Map001',
    spawnPoints: { Map001: { x: 0.5, y: 0.5 } },
    objects: {
      obj_door: {
        name: '澶ч棬', kind: 'SceneObject', mapName: 'Map001', position: { x: 0.2, y: 0.3 },
        componentData: [
          { component: 'OptionValue', displayName: '鐘舵€?, data: JSON.stringify({ options: ['鍏?, '寮€'], currentOption: '鍏? }) },
          { component: 'Backpack', displayName: '鐗╁搧', data: JSON.stringify({ items: [] }) },
        ],
      },
    },
    players: { p1: { name: '鎴樺＋', mapName: 'Map001', position: { x: 0.5, y: 0.5 } } },
  };
  selectedObjectId = 'obj_door';
  render();
  return 'ok';
})()`;

const INSPECT_PICKER = `(function () {
  const m = document.getElementById('itemPickerModal');
  const q = (s) => {
    const e = m.querySelector(s);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return {
      t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right),
      w: Math.round(r.width), h: Math.round(r.height),
      outB: r.bottom > innerHeight + 1, outT: r.top < -1, outR: r.right > innerWidth + 1, outL: r.left < -1,
    };
  };
  const body = m.querySelector('.modal-body');
  const list = document.getElementById('pickerList');
  return JSON.stringify({
    inner: { w: innerWidth, h: innerHeight },
    modal: q('.modal'),
    header: q('.modal-header'),
    search: q('#pickerSearch'),
    cat: q('#pickerCategory'),
    body: q('.modal-body'),
    listCol: q('.modal-list-col'),
    detailCol: q('.modal-detail-col'),
    footer: q('.modal-footer'),
    confirm: q('#pickerConfirm'),
    cancel: q('.modal-footer .state-btn:not(.picker-confirm)'),
    bodyScrollH: body.scrollHeight, bodyClientH: body.clientHeight,
    listScrollH: list.scrollHeight, listClientH: list.clientHeight,
    itemRows: document.querySelectorAll('#pickerList .item-row').length,
  });
})()`;

const INSPECT_MASK = `(function () {
  const m = document.getElementById('maskEditorModal');
  const q = (s) => {
    const e = m.querySelector(s);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return {
      t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right),
      w: Math.round(r.width), h: Math.round(r.height),
      outB: r.bottom > innerHeight + 1, outT: r.top < -1, outR: r.right > innerWidth + 1, outL: r.left < -1,
    };
  };
  const body = m.querySelector('.mask-editor-body');
  const canvas = document.getElementById('maskCanvas');
  return JSON.stringify({
    inner: { w: innerWidth, h: innerHeight },
    modal: q('.modal'),
    header: q('.modal-header'),
    hint: q('.modal-hint'),
    tools: q('.mask-editor-tools'),
    body: q('.mask-editor-body'),
    canvas: q('#maskCanvas'),
    bodyScrollH: body.scrollHeight, bodyClientH: body.clientHeight,
    canvasW: canvas.width, canvasH: canvas.height,
  });
})()`;

async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions',
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
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: 812, height: 375, deviceScaleFactor: 2, mobile: true,
      screenOrientation: { type: 'landscapePrimary', angle: 90 },
    });
    await page.send('Page.navigate', { url: PAGE_URL });
    await sleep(3500);
    await page.eval(INJECT_STATE);

    await page.eval(`selectObject('obj_door'); openItemPicker('obj_door')`);
    await sleep(500);
    console.log('PICKER:', await page.eval(INSPECT_PICKER));

    await page.eval(`closeItemPicker()`);
    await page.eval(`(function(){ state.objects.obj_mask = { name: '杩烽浘', kind: 'Mask', mapName: 'Map001', position: { x: 0.5, y: 0.5 }, componentData: [{ component: 'MaskImage', displayName: '閬僵', data: JSON.stringify({ maskWidth: 1920, maskHeight: 1080 }) }] }; openMaskEditor('obj_mask'); return 'ok'; })()`);
    await sleep(500);
    console.log('MASK:', await page.eval(INSPECT_MASK));

    // 妗岄潰 1080p 澶嶆祴锛氬脊妗嗗簲淇濇寔 4:3 澶у昂瀵革紙涓嶈Е鍙戠煯瑙嗗彛瑕嗙洊锛?    await page.send('Emulation.setDeviceMetricsOverride', {
      width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false,
      screenOrientation: { type: 'landscapePrimary', angle: 90 },
    });
    await sleep(400);
    await page.eval(`closeMaskEditor(); selectObject('obj_door'); openItemPicker('obj_door')`);
    await sleep(400);
    console.log('DESKTOP:', await page.eval(`(function(){
      const mb = document.querySelector('#itemPickerModal .modal').getBoundingClientRect();
      const body = document.querySelector('#itemPickerModal .modal-body');
      const list = document.getElementById('pickerList');
      return JSON.stringify({ inner: { w: innerWidth, h: innerHeight }, modalW: Math.round(mb.width), modalH: Math.round(mb.height), bodyH: Math.round(body.clientHeight), listH: Math.round(list.clientHeight), listScroll: list.scrollHeight, ratio: (mb.width / mb.height).toFixed(3) });
    })()`));
  } finally {
    try { chrome.kill(); } catch (e) {}
    process.exit(0);
  }
}
main().catch((e) => { console.error('FAIL:', e); process.exit(1); });

