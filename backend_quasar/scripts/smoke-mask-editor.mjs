import { chromium } from 'playwright';
import WebSocket from 'ws';

const CLIENT_WS_URL = 'ws://localhost:1420/client';
const GM_PAGE_URL = 'http://localhost:9000';
const OBJECT_ID = 'test-mask-object';

function waitForServer(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function tryConnect() {
      const ws = new WebSocket(url);
      ws.on('open', () => {
        ws.close();
        resolve();
      });
      ws.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
        } else {
          setTimeout(tryConnect, 300);
        }
      });
    }
    tryConnect();
  });
}

function sendClientState(ws) {
  ws.send(
    JSON.stringify({
      type: 'register_map_objects',
      mapName: 'Map001',
      spawnPoints: [{ id: 'spawn1' }],
      objects: [
        {
          id: OBJECT_ID,
          name: 'Mask Test Object',
          kind: 'object',
          mapName: 'Map001',
          position: { x: 0.5, y: 0.5 },
          componentData: [
            {
              component: 'MaskImage',
              displayName: '遮罩',
              data: JSON.stringify({ maskWidth: 400, maskHeight: 300 }),
            },
          ],
        },
      ],
    }),
  );
}

async function main() {
  await waitForServer(CLIENT_WS_URL);

  const clientWs = new WebSocket(CLIENT_WS_URL);
  await new Promise((resolve, reject) => {
    clientWs.on('open', resolve);
    clientWs.on('error', reject);
  });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  const sentFrames = [];
  page.on('websocket', (ws) => {
    ws.on('framesent', (frame) => sentFrames.push(frame.payload));
  });

  await page.goto(GM_PAGE_URL);

  // Wait for the app to connect to the GM WebSocket
  await page.waitForSelector('.q-chip:has-text("已连接")', { timeout: 10000 });

  sendClientState(clientWs);

  // Wait for the object marker to appear and click it
  const marker = await page.waitForSelector(`.object-marker[data-object-id="${OBJECT_ID}"]`, {
    timeout: 10000,
  });
  await marker.click();

  // Open the property page
  await page.getByText('属性', { exact: true }).click();

  // Open the mask editor
  await page.getByRole('button', { name: '编辑遮罩' }).click();

  // Draw on the canvas
  const canvas = await page.waitForSelector('.mask-canvas', { state: 'visible', timeout: 10000 });
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas bounding box not found');

  const startX = box.x + box.width * 0.25;
  const startY = box.y + box.height * 0.25;
  const endX = box.x + box.width * 0.75;
  const endY = box.y + box.height * 0.75;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 10 });
  await page.mouse.up();

  // Allow time for WebSocket frames to be sent
  await page.waitForTimeout(500);

  const eraseFrames = sentFrames.filter(
    (f) => typeof f === 'string' && f.includes('"type":"gm_erase_mask"') && f.includes(`"objectId":"${OBJECT_ID}"`),
  );

  const ok = eraseFrames.length > 0;
  console.log(ok ? 'PASS: gm_erase_mask frames sent' : 'FAIL: no gm_erase_mask frames found');
  console.log(`Total WS frames sent: ${sentFrames.length}`);
  if (eraseFrames.length > 0) {
    console.log('Sample frame:', eraseFrames[0].slice(0, 200));
  }

  await browser.close();
  clientWs.close();
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
