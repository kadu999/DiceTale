// 测量遮罩弹框画布/地图背景比例链，找出拉伸点。
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
        componentData: [{ component: 'MaskImage', data: JSON.stringify({ maskWidth: 960, maskHeight: 540, edgeFeather: 1 }) }] }
    }, players: {} };
    openMaskEditor('testObj');
    return 'opened';
  })()`);
  await new Promise((r) => setTimeout(r, 900));

  const expr = `(function(){
    const cvs = document.getElementById('maskCanvas');
    const editor = document.querySelector('.mask-editor-body');
    const mapImg = document.getElementById('mapImage');
    const cs = getComputedStyle(cvs);
    const r = cvs.getBoundingClientRect();
    const er = editor.getBoundingClientRect();
    // 地图背景图（预载到隐藏 img 上量自然尺寸）
    const bg = new Image();
    bg.src = cvs.style.backgroundImage.replace(/^url\\(['"]?/, '').replace(/['"]?\\)$/, '');
    return new Promise((res) => {
      bg.onload = () => res(JSON.stringify({
        canvasAttr: { w: cvs.width, h: cvs.height, ratio: (cvs.width / cvs.height).toFixed(4) },
        canvasDisplay: { w: Math.round(r.width), h: Math.round(r.height), ratio: (r.width / r.height).toFixed(4) },
        canvasStyle: { w: cs.width, h: cs.height },
        editorRect: { w: Math.round(er.width), h: Math.round(er.height) },
        mapNatural: { w: bg.naturalWidth, h: bg.naturalHeight, ratio: (bg.naturalWidth / bg.naturalHeight).toFixed(4) },
        mainMapImage: mapImg ? { natural: mapImg.naturalWidth + 'x' + mapImg.naturalHeight, displayed: Math.round(mapImg.getBoundingClientRect().width) + 'x' + Math.round(mapImg.getBoundingClientRect().height) } : null,
        viewport: innerWidth + 'x' + innerHeight,
      }, null, 1));
    });
  })()`;
  console.log(await evalJs(expr));
  ws.close();
  process.exit(0);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
