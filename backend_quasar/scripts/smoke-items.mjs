import { spawn } from 'child_process';
import { chromium } from 'playwright';
import WebSocket from 'ws';
import { setTimeout as sleep } from 'timers/promises';
import { platform } from 'os';

const SERVER_URL = 'http://localhost:1420';
const DEV_URL = 'http://localhost:9000';
const OBJECT_ID = 'test-hero';

const isWin = platform() === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

function run(cmd, args, opts = {}) {
  const proc = isWin
    ? spawn('cmd', ['/c', cmd, ...args], { stdio: 'pipe', ...opts })
    : spawn(cmd, args, { stdio: 'pipe', ...opts });
  const logs = [];
  proc.stdout.on('data', (d) => logs.push(d.toString()));
  proc.stderr.on('data', (d) => logs.push(d.toString()));
  return { proc, logs };
}

async function killTree(pid) {
  return new Promise((resolve) => {
    const killer = isWin
      ? spawn('cmd', ['/c', `taskkill /T /F /PID ${pid}`], { stdio: 'ignore' })
      : spawn('kill', ['-9', `-${pid}`], { stdio: 'ignore' });
    killer.on('close', resolve);
    killer.on('error', resolve);
    setTimeout(resolve, 3000);
  });
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // ignore
    }
    await sleep(500);
  }
  throw new Error(`Server ${url} did not start in ${timeoutMs}ms`);
}

async function connectMockClient() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${SERVER_URL.replace('http', 'ws')}/client`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
    setTimeout(() => reject(new Error('Mock client connection timeout')), 10000);
  });
}

async function main() {
  console.log('Starting backend server...');
  const server = run(npmCmd, ['run', 'serve'], { cwd: process.cwd() });
  try {
    await waitForServer(SERVER_URL);
  } catch (e) {
    console.error('Backend server failed to start. Logs:');
    console.error(server.logs.join(''));
    throw e;
  }

  console.log('Connecting mock game client...');
  const clientWs = await connectMockClient();

  console.log('Registering test object...');
  clientWs.send(JSON.stringify({
    type: 'register_map_objects',
    mapName: 'Map001',
    objects: [{
      id: OBJECT_ID,
      name: 'Test Hero',
      kind: 'Player',
      mapName: 'Map001',
      position: { x: 0.5, y: 0.5 },
      componentData: [
        { component: 'Backpack', displayName: '背包', data: JSON.stringify({ items: ['Sword'] }) },
        { component: 'ItemExchange', displayName: '商店', data: JSON.stringify({ itemName: '自来水笔', quantity: 5 }) },
      ],
    }],
    spawnPoints: [],
  }));
  await sleep(500);

  console.log('Starting Quasar dev server...');
  const dev = run(npmCmd, ['run', 'dev'], { cwd: process.cwd() });
  try {
    await waitForServer(DEV_URL);
  } catch (e) {
    console.error('Dev server failed to start. Logs:');
    console.error(dev.logs.join(''));
    throw e;
  }
  await sleep(2000);

  console.log('Opening browser...');
  const browser = await chromium.launch({ headless: true });
  let sentMessage = null;
  let clientReceived = null;

  try {
    const page = await browser.newPage();

    page.on('websocket', (ws) => {
      ws.on('framesent', (event) => {
        try {
          const data = JSON.parse(event.payload);
          if (data.type === 'gm_set_object_items') sentMessage = data;
        } catch {
          // ignore non-json
        }
      });
    });

    clientWs.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        if (data.type === 'set_object_items') clientReceived = data;
      } catch {
        // ignore
      }
    });

    await page.goto(`${DEV_URL}/map`);
    await page.waitForSelector('.object-marker', { timeout: 10000 });
    await page.locator('.object-marker').first().evaluate((el) => el.click());
    await sleep(800);

    await page.locator('a[href="#/items"], a[href="/items"]').first().click();
    await sleep(1000);

    await page.waitForSelector('[data-testid="open-picker"]', { timeout: 10000 });
    await page.click('[data-testid="open-picker"]');

    await page.waitForSelector('[data-testid="catalog-item"]', { timeout: 10000 });
    await page.click('[data-testid="catalog-item"]');

    await page.fill('input[type="number"]', '2');
    await page.click('[data-testid="confirm-add"]');

    await sleep(1000);

    if (!sentMessage) throw new Error('GM did not send gm_set_object_items');
    if (sentMessage.objectId !== OBJECT_ID) throw new Error(`Unexpected objectId: ${sentMessage.objectId}`);

    const expectedItems = ['Sword', '自来水笔', '自来水笔'];
    if (JSON.stringify(sentMessage.items) !== JSON.stringify(expectedItems)) {
      throw new Error(`Unexpected items: ${JSON.stringify(sentMessage.items)}`);
    }

    if (!clientReceived) throw new Error('Client did not receive forwarded set_object_items');

    console.log('Smoke test passed: item allocation sent set_object_items end-to-end.');
  } finally {
    await browser.close();
    await killTree(dev.proc.pid);
    clientWs.close();
  }

  await killTree(server.proc.pid);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
