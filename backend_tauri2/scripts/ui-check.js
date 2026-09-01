// DiceTale GM 前端布局验证闭环（移动优先）。
// 起后端（若未运行）→ 在视口矩阵上逐页加载 → 注入演示 state 渲染真实内容 →
// 断言（无横向溢出 / 触控目标 ≥44px / 桌面视口下 main 不整页滚动）→ 截图存档。
//
// 用法：node scripts/ui-check.js
//   --viewports 360x640,412x915,768x1024,1024x768,1440x900  自定义视口矩阵
//   --shots    截图目录（默认 ui-shots）
//
// 浏览器优先用系统 Edge（Windows 自带，无需下载）；无 Edge 时退回 Playwright 自带 Chromium
// （首次需 npx playwright install chromium）。
//
// 说明：GM 页面必须有 WS 数据才渲染内容，本脚本注入一份演示 state（地图/对象/玩家），
// 专门用于验证布局；真实数据下的渲染路径相同。

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const BASE = 'http://localhost:1420';
const DEFAULT_VIEWPORTS = ['360x640', '412x915', '640x360', '873x393', '768x1024', '1024x768', '1440x900'];

// ---- 参数 ----
const args = process.argv.slice(2);
function argVal(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
const viewports = argVal('--viewports', DEFAULT_VIEWPORTS.join(',')).split(',').filter(Boolean);
const shotsDir = path.join(ROOT, argVal('--shots', 'ui-shots'));

// ---- 演示 state（与 server/src/types.ts 的 GameStateSnapshot 形状一致） ----
const DEMO_STATE = {
  currentMap: 'Map001',
  spawnPoints: { Map001: [{ id: 'S1' }, { id: 'S2' }] },
  players: {
    p1: { name: '勇者', mapName: 'Map001', position: { x: 0.2, y: 0.35 } },
    p2: { name: '法师', mapName: 'Map001', position: { x: 0.55, y: 0.5 } },
    p3: { name: '盗贼', mapName: 'Map001', position: { x: 0.8, y: 0.7 } },
  },
  objects: {
    door1: {
      name: '古堡大门', kind: 'SceneObject', mapName: 'Map001', position: { x: 0.5, y: 0.12 },
      componentData: [{ component: 'OptionValue', displayName: '大门', data: JSON.stringify({ options: ['关闭', '开启'], currentOption: '关闭' }) }],
    },
    chest1: {
      name: '宝箱', kind: 'SceneObject', mapName: 'Map001', position: { x: 0.25, y: 0.6 },
      componentData: [{ component: 'OptionValue', displayName: '宝箱', data: JSON.stringify({ options: ['锁定', '打开'], currentOption: '锁定' }) }],
    },
    torch1: {
      name: '火把', kind: 'SceneObject', mapName: 'Map001', position: { x: 0.75, y: 0.42 },
      componentData: [{ component: 'OptionValue', displayName: '火把', data: JSON.stringify({ options: ['熄灭', '点燃'], currentOption: '点燃' }) }],
    },
  },
};

// ---- 后端进程管理 ----
let backendChild = null;
function isUp() {
  return new Promise((resolve) => {
    const req = http.get(BASE + '/', { timeout: 800 }, (res) => { res.resume(); resolve(true); });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}
async function ensureBackend() {
  if (await isUp()) return;
  const tsxCli = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  backendChild = spawn(process.execPath, [tsxCli, 'server/src/index.ts'], {
    cwd: ROOT, stdio: 'inherit',
  });
  backendChild.on('exit', (code) => { backendChild = null; console.log(`[ui-check] backend exited (${code})`); });
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await isUp()) return;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('后端 15s 内未就绪');
}

// ---- 页面内断言 ----
const CHECK_SCRIPT = `(() => {
  const vw = window.innerWidth;
  const doc = document.documentElement;
  const main = document.querySelector('main');
  const nav = document.querySelector('nav');

  // 1) 横向溢出：文档宽度超出视口
  const overflow = doc.scrollWidth > vw + 1;

  // 1b) 导航栏自身不溢出
  const navOverflow = nav && nav.scrollWidth > nav.clientWidth + 1;

  // 2) 触控目标：关键交互元素高度 < 44px（可见的）
  const smallTouch = [];
  for (const sel of ['.map-tabs button', '.category-tag', '.state-btn', '.item-row', '.page-tab']) {
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.width > 0 && r.height < 43.5) {
        smallTouch.push(sel + ' (' + Math.round(r.height) + 'px): ' + (el.textContent || '').trim().slice(0, 20));
      }
    }
  }

  // 3) 三栏面板视口（≥576px，与 gm.css 断点一致）下 main 不应整页滚动（布局已锁定在面板内）
  const mainScrolls = vw >= 576 && main.scrollHeight > main.clientHeight + 2;

  // 4) 越界元素（供定位用，截取前 8 个）
  const offenders = [];
  if (overflow) {
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > vw + 1 && r.left < vw) {
        offenders.push((el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) + ' right=' + Math.round(r.right));
        if (offenders.length >= 8) break;
      }
    }
  }

  // 5) 关键几何（供人工核对布局质量）
  const geo = {};
  const box = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), r: Math.round(b.right), btm: Math.round(b.bottom) }; };
  const activePage = document.querySelector('.page.active');
  geo.navbar = box(nav);
  geo.main = box(main);
  geo.mapCell = box(document.querySelector('.map-cell'));
  geo.mapContainer = box(document.getElementById('mapContainer'));
  geo.cols = activePage ? [...activePage.querySelectorAll('.row > [class*="col-"]')].map(box) : [];
  geo.markers = [...document.querySelectorAll('.player-marker')].map(box);
  const shownModal = document.querySelector('.modal.show .modal-dialog');
  geo.modal = box(shownModal);
  return { overflow, navOverflow, smallTouch, mainScrolls, offenders, geo };
})()`;

// ---- 主流程 ----
async function main() {
  const { chromium } = require('playwright');
  fs.mkdirSync(shotsDir, { recursive: true });

  await ensureBackend();

  let browser = null;
  for (const channel of ['msedge', 'chrome', undefined]) {
    try {
      browser = await chromium.launch({ channel });
      console.log(`[ui-check] 浏览器: ${channel || 'chromium（自带）'}`);
      break;
    } catch (e) {
      if (channel !== undefined) console.log(`[ui-check] ${channel} 不可用，尝试下一个…`);
      else throw new Error('没有可用浏览器：请安装 Edge/Chrome，或运行 npx playwright install chromium');
    }
  }

  const report = [];
  let failed = false;
  async function check(page, vp, label) {
    const res = await page.evaluate(CHECK_SCRIPT);
    report.push({ viewport: vp, page: label, overflow: res.overflow, navOverflow: res.navOverflow, mainScrolls: res.mainScrolls, smallTouch: res.smallTouch });
    const bad = res.overflow || res.navOverflow || res.smallTouch.length > 0 || res.mainScrolls;
    if (bad) failed = true;
    console.log(`[ui-check] ${vp} ${label}: overflow=${res.overflow} navOverflow=${res.navOverflow} mainScrolls=${res.mainScrolls} touch<44px=${res.smallTouch.length}`);
    console.log(`  navbar=${JSON.stringify(res.geo.navbar)}`);
    if (res.geo.cols.length) console.log(`  cols=${JSON.stringify(res.geo.cols)}`);
    if (res.geo.mapContainer) console.log(`  mapContainer=${JSON.stringify(res.geo.mapContainer)}`);
    if (res.geo.modal) console.log(`  modal=${JSON.stringify(res.geo.modal)}`);
    for (const t of res.smallTouch.slice(0, 5)) console.log(`  touch: ${t}`);
    for (const o of res.offenders.slice(0, 5)) console.log(`  overflow-el: ${o}`);
  }

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(10000);

    for (const vp of viewports) {
      const [w, h] = vp.split('x').map(Number);
      await page.setViewportSize({ width: w, height: h });
      await page.goto(BASE + '/', { waitUntil: 'networkidle' });

      // 注入演示 state 并渲染
      await page.evaluate((demo) => { state = demo; render(); }, DEMO_STATE);
      await page.waitForFunction(() => {
        const img = document.getElementById('mapImage');
        return img && img.complete && img.naturalWidth > 0;
      });

      // 地图页（默认）
      await page.evaluate(() => selectObject('chest1'));
      await page.waitForTimeout(150);
      await shot(page, vp, 'map');
      await check(page, vp, 'map');

      // 玩家页
      await page.evaluate(() => switchPage('players'));
      await page.waitForTimeout(100);
      await shot(page, vp, 'players');
      await check(page, vp, 'players');

      // 道具页
      await page.evaluate(() => switchPage('items'));
      await page.waitForTimeout(100);
      await shot(page, vp, 'items');
      await check(page, vp, 'items');

      // 道具选择弹框（等 show 动画完成，避免截到过渡态 / hide() 被 no-op）
      await page.evaluate(() => openItemPicker('chest1'));
      await page.waitForTimeout(500);
      await shot(page, vp, 'items-picker');
      await check(page, vp, 'items-picker');

      // 关闭弹框（测试环境清理用；每个视口都是全新加载，无需严格等动画）
      await page.evaluate(() => {
        try { closeItemPicker(); } catch (e) { /* ignore */ }
      });
      await page.waitForTimeout(500);
      await page.evaluate(() => {
        const m = document.getElementById('itemPickerModal');
        if (m && m.classList.contains('show')) {
          m.classList.remove('show');
          m.style.display = 'none';
          const b = document.querySelector('.modal-backdrop');
          if (b) b.remove();
        }
      });
    }
  } finally {
    if (browser) await browser.close();
    if (backendChild) { backendChild.kill(); backendChild = null; }
  }

  fs.writeFileSync(path.join(shotsDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`[ui-check] 报告: ${path.join(shotsDir, 'report.json')}`);
  console.log(failed ? '[ui-check] 存在违规项' : '[ui-check] 全部通过');
  process.exit(failed ? 1 : 0);
}

async function shot(page, vp, name) {
  const file = path.join(shotsDir, `${vp}_${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
}

main().catch((err) => {
  console.error('[ui-check] 失败:', err.message);
  if (backendChild) backendChild.kill();
  process.exit(1);
});
