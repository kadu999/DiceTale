import WebSocket from 'ws';
import { test, expect } from '../fixtures/server';

function openClientSocket(serverUrl: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(serverUrl.replace(/^http/, 'ws') + '/client');
    socket.on('open', () => resolve(socket));
    socket.on('error', reject);
  });
}

function send(socket: WebSocket, message: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.send(JSON.stringify(message), (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

test('loads SPA and shows map view', async ({ page, serverUrl }) => {
  await page.goto(serverUrl);
  await expect(page.getByText('DiceTale GM')).toBeVisible();
  await expect(page.locator('img[alt="地图"]')).toBeVisible();
});

test('map page renders map list and property panel sections', async ({ page, serverUrl }) => {
  await page.goto(serverUrl);
  await expect(page.getByRole('main').getByText('地图', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('属性', { exact: true })).toBeAttached();

  const mapList = page.locator('.map-list');
  await expect(mapList.getByText('Map001')).toBeVisible();
  await expect(mapList.getByText('Map002')).toBeVisible();
  await expect(mapList.getByText('Map003')).toBeVisible();
});

test('selecting a map object shows its properties in the right panel', async ({ page, serverUrl }) => {
  await page.goto(serverUrl);
  await expect(page.getByText('已连接')).toBeVisible();

  const socket = await openClientSocket(serverUrl);
  try {
    await send(socket, {
      type: 'register_map_objects',
      mapName: 'Map001',
      objects: [
        {
          id: 'o1',
          name: '测试宝箱',
          position: { x: 0.5, y: 0.5 },
          componentData: JSON.stringify([
            { component: 'IntValue', displayName: '生命值', data: { value: 10 } },
            { component: 'Backpack', displayName: '背包', data: { items: [] } },
          ]),
        },
      ],
    });

    const marker = page.locator('.object-marker');
    await expect(marker).toHaveText('测试宝箱');
    await marker.click();

    const panel = page.locator('.map-property-panel');
    await expect(panel.getByText('测试宝箱')).toBeVisible();
    await expect(panel.getByText('生命值')).toBeVisible();

    await panel.getByRole('button', { name: '添加道具' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('选择道具')).toBeVisible();
  } finally {
    socket.close();
  }
});
