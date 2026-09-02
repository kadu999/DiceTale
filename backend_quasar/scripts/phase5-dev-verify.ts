import { chromium } from 'playwright';
import { WebSocket } from 'ws';

const GM_URL = process.env.GM_URL || 'http://localhost:9000';
const SERVER_WS = process.env.SERVER_WS || 'ws://localhost:1420/client';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForClientWs(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) return resolve();
    ws.once('open', resolve);
    ws.once('error', reject);
  });
}

async function main(): Promise<void> {
  // 1. 连接一个假客户端并上报带属性组件的对象
  const clientWs = new WebSocket(SERVER_WS);
  await waitForClientWs(clientWs);
  console.log('[verify] client ws readyState:', clientWs.readyState);

  const clientMessages: unknown[] = [];
  clientWs.on('open', () => console.log('[verify] client ws open event'));
  clientWs.on('error', (err) => console.log('[verify] client ws error:', err.message));
  clientWs.on('close', (code) => console.log('[verify] client ws closed code:', code));
  clientWs.on('message', (data) => {
    console.log('[verify] client message:', String(data).slice(0, 200));
    try {
      clientMessages.push(JSON.parse(String(data)));
    } catch {}
  });

  const componentData = [
    { component: 'OptionValue', displayName: '状态', data: JSON.stringify({ options: ['Idle', 'Attack'], currentOption: 'Idle' }) },
    { component: 'IntValue', displayName: '生命', data: JSON.stringify({ value: 10, enableRange: true, min: 0, max: 100 }) },
    { component: 'BoolValue', displayName: '激活', data: JSON.stringify({ value: true }) },
    { component: 'Backpack', displayName: '背包', data: JSON.stringify({ items: ['Potion'] }) },
    { component: 'ItemExchange', displayName: '道具交换', data: JSON.stringify({ itemName: 'Potion', quantity: 5 }) },
    { component: 'MaskImage', displayName: '遮罩', data: JSON.stringify({}) },
  ];

  const registerMsg = JSON.stringify({
    type: 'register_map_objects',
    mapName: 'Map001',
    spawnPoints: [],
    objects: [
      {
        id: 'o1',
        name: 'TestObject',
        kind: 'object',
        mapName: 'Map001',
        position: { x: 0.5, y: 0.5 },
        componentData,
      },
    ],
  });
  console.log('[verify] sending register_map_objects');
  clientWs.send(registerMsg);

  await sleep(800);

  // 2. 用 Playwright 打开 GM 页面
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(GM_URL, { waitUntil: 'networkidle' });
  await sleep(1000);

  // 3. 等待对象标记出现并点击
  await page.waitForSelector('[data-object-id="o1"]', { timeout: 10000 });
  await page.click('[data-object-id="o1"]');
  await sleep(200);

  // 4. 切到属性页
  await page.click('text=属性');
  await sleep(500);

  // 5. 验证字段渲染
  const propertyText = await page.locator('body').innerText();
  const propertyHtml = await page.locator('body').innerHTML();
  console.log('Property page text:', propertyText.slice(0, 1000));
  console.log('Property page HTML (first 2000):', propertyHtml.slice(0, 2000));
  const checks = ['TestObject', '状态', '生命', '激活', '背包', '道具交换', '遮罩', 'Idle', 'Attack', 'Potion'];
  const missing = checks.filter((c) => !propertyText.toLowerCase().includes(c.toLowerCase()));
  if (missing.length > 0) {
    throw new Error(`属性页缺少内容：${missing.join(', ')}`);
  }

  // 6. 点击选项按钮触发 gm_set_option
  await page.click('text=Attack');
  await sleep(500);

  const optionMsg = clientMessages.find(
    (m: any) => m.type === 'set_option' && m.objectId === 'o1' && m.option === 'Attack',
  );
  if (!optionMsg) {
    console.log('Client messages:', JSON.stringify(clientMessages.slice(-10)));
    throw new Error('未从客户端通道捕获到 set_option 转发命令');
  }

  console.log('✅ Phase 5 dev verification passed');
  console.log('Captured server->client command:', JSON.stringify(optionMsg));

  await browser.close();
  clientWs.close();
}

main().catch((err) => {
  console.error('❌ Phase 5 dev verification failed:', err);
  process.exit(1);
});
