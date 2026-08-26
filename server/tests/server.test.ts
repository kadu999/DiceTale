import WebSocket from 'ws';
import http from 'http';
import { AddressInfo } from 'net';
import { server } from '../src/index';

interface SocketHandle {
  ws: WebSocket;
  /** FIFO 顺序取下一条消息；连接早期到达的消息会被缓冲，不会丢失。 */
  next: () => Promise<any>;
}

function connect(path: string): Promise<SocketHandle> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}${path}`);
    const queue: any[] = [];
    const waiters: Array<(m: any) => void> = [];

    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      const waiter = waiters.shift();
      if (waiter) waiter(msg);
      else queue.push(msg);
    });

    ws.on('open', () =>
      resolve({
        ws,
        next: () =>
          queue.length > 0
            ? Promise.resolve(queue.shift())
            : new Promise((res) => waiters.push(res)),
      })
    );

    ws.on('error', reject);
  });
}

function send(ws: WebSocket, message: unknown) {
  ws.send(JSON.stringify(message));
}

function httpGet(path: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    http
      .get({ host: 'localhost', port, path }, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode!, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode!, body: data });
          }
        });
      })
      .on('error', reject);
  });
}

let httpServer: http.Server;
let port: number;
const openSockets: WebSocket[] = [];

beforeAll((done) => {
  httpServer = server;
  httpServer.listen(0, () => {
    port = (httpServer.address() as AddressInfo).port;
    done();
  });
});

afterAll((done) => {
  for (const ws of openSockets) {
    try {
      ws.terminate();
    } catch {
      // ignore
    }
  }
  httpServer.close(done);
});

describe('WebSocket server', () => {
  test('client can connect and receive sync_state after request_join', async () => {
    const client = await connect('/client');
    openSockets.push(client.ws);
    send(client.ws, { type: 'request_join' });

    const msg = await client.next();
    expect(msg.type).toBe('sync_state');
    expect(msg.state.currentMap).toBeDefined();
    expect(msg.state.spawnPoints).toBeDefined();
  });

  test('client-registered door with position appears in gm snapshot', async () => {
    const client = await connect('/client');
    openSockets.push(client.ws);
    send(client.ws, { type: 'request_join' });
    await client.next(); // sync_state

    send(client.ws, {
      type: 'register_map_objects',
      mapName: 'Map001',
      doors: [
        { id: 'ClientDoor_1', targetMap: 'Map002', targetSpawn: 'North', isPortal: true, position: { x: 0.81, y: 0.45 } },
        { id: 'ClientDoor_2', targetMap: 'Map002', targetSpawn: 'Default', isPortal: false },
      ],
      spawnPoints: [{ id: 'Default' }],
    });

    const gm = await connect('/gm');
    openSockets.push(gm.ws);
    const update = await gm.next(); // 客户端注册后广播的 gm_update

    const door1 = update.state.doors['ClientDoor_1'];
    expect(door1).toBeDefined();
    expect(door1.mapName).toBe('Map001');
    expect(door1.position).toEqual({ x: 0.81, y: 0.45 });
    expect(door1.isPortal).toBe(true);

    // 未上报 position 的门使用默认中心位置，mapName 取注册时的地图
    const door2 = update.state.doors['ClientDoor_2'];
    expect(door2.mapName).toBe('Map001');
    expect(door2.position).toEqual({ x: 0.5, y: 0.5 });

    expect(update.state.spawnPoints['Map001']).toEqual([{ id: 'Default' }]);
  });

  test('portal door access triggers teleport_player', async () => {
    const client = await connect('/client');
    openSockets.push(client.ws);
    send(client.ws, { type: 'request_join' });
    await client.next(); // sync_state

    send(client.ws, {
      type: 'register_map_objects',
      mapName: 'Map001',
      doors: [{ id: 'TestPortalA', targetMap: 'Map002', targetSpawn: 'North', isPortal: true }],
      spawnPoints: [{ id: 'Default' }, { id: 'North' }],
    });
    send(client.ws, { type: 'request_door_access', doorId: 'TestPortalA' });

    const msg = await client.next();
    expect(msg.type).toBe('teleport_player');
    expect(msg.mapName).toBe('Map002');
    expect(msg.spawnId).toBe('North');
  });

  test('normal door access triggers set_door_state unlocked', async () => {
    const client = await connect('/client');
    openSockets.push(client.ws);
    send(client.ws, { type: 'request_join' });
    await client.next(); // sync_state

    send(client.ws, {
      type: 'register_map_objects',
      mapName: 'Map001',
      doors: [{ id: 'TestDoorB', targetMap: 'Map002', targetSpawn: 'Default', isPortal: false }],
      spawnPoints: [{ id: 'Default' }],
    });
    send(client.ws, { type: 'request_door_access', doorId: 'TestDoorB' });

    const msg = await client.next();
    expect(msg.type).toBe('set_door_state');
    expect(msg.doorId).toBe('TestDoorB');
    expect(msg.unlocked).toBe(true);
  });

  test('unknown door access is ignored without command', async () => {
    const client = await connect('/client');
    openSockets.push(client.ws);
    send(client.ws, { type: 'request_join' });
    await client.next(); // sync_state

    send(client.ws, { type: 'request_door_access', doorId: 'MissingDoor' });

    let receivedCommand = false;
    client.ws.on('message', () => {
      receivedCommand = true;
    });
    await new Promise((r) => setTimeout(r, 200));
    expect(receivedCommand).toBe(false);
  });

  test('gm connects and receives initial gm_update', async () => {
    const gm = await connect('/gm');
    openSockets.push(gm.ws);
    const msg = await gm.next();
    expect(msg.type).toBe('gm_update');
    expect(msg.state.currentMap).toBeDefined();
  });

  test('gm_open_door pushes set_door_state to connected client', async () => {
    const client = await connect('/client');
    openSockets.push(client.ws);
    send(client.ws, { type: 'request_join' });
    await client.next(); // sync_state
    send(client.ws, {
      type: 'register_map_objects',
      mapName: 'Map001',
      doors: [{ id: 'TestDoorC', targetMap: 'Map002', targetSpawn: 'Default', isPortal: false }],
      spawnPoints: [{ id: 'Default' }],
    });

    const gm = await connect('/gm');
    openSockets.push(gm.ws);
    await gm.next(); // initial gm_update
    send(gm.ws, { type: 'gm_open_door', doorId: 'TestDoorC' });

    const msg = await client.next();
    expect(msg.type).toBe('set_door_state');
    expect(msg.doorId).toBe('TestDoorC');
    expect(msg.unlocked).toBe(true);
  });

  test('gm_close_door pushes set_door_state unlocked=false', async () => {
    const client = await connect('/client');
    openSockets.push(client.ws);
    send(client.ws, { type: 'request_join' });
    await client.next(); // sync_state
    send(client.ws, {
      type: 'register_map_objects',
      mapName: 'Map001',
      doors: [{ id: 'CloseDoorTest', targetMap: 'Map002', targetSpawn: 'Default', isPortal: false }],
      spawnPoints: [{ id: 'Default' }],
    });

    const gm = await connect('/gm');
    openSockets.push(gm.ws);
    await gm.next(); // 客户端注册后广播的 gm_update

    send(gm.ws, { type: 'gm_open_door', doorId: 'CloseDoorTest' });
    const opened = await client.next();
    expect(opened.type).toBe('set_door_state');
    expect(opened.unlocked).toBe(true);

    send(gm.ws, { type: 'gm_close_door', doorId: 'CloseDoorTest' });
    const closed = await client.next();
    expect(closed.type).toBe('set_door_state');
    expect(closed.doorId).toBe('CloseDoorTest');
    expect(closed.unlocked).toBe(false);

    gm.ws.close();
    client.ws.close();
  });

  test('gm_teleport_player pushes teleport_player to connected client', async () => {
    const client = await connect('/client');
    openSockets.push(client.ws);
    send(client.ws, { type: 'request_join' });
    await client.next(); // sync_state

    const gm = await connect('/gm');
    openSockets.push(gm.ws);
    await gm.next(); // initial gm_update
    send(gm.ws, { type: 'gm_teleport_player', mapName: 'Map003', spawnId: 'Default' });

    const msg = await client.next();
    expect(msg.type).toBe('teleport_player');
    expect(msg.mapName).toBe('Map003');
    expect(msg.spawnId).toBe('Default');
  });

  test('report_player_position updates gm snapshot', async () => {
    const client = await connect('/client');
    openSockets.push(client.ws);
    send(client.ws, { type: 'request_join' });
    await client.next(); // sync_state

    const gm = await connect('/gm');
    openSockets.push(gm.ws);
    await gm.next(); // initial gm_update

    send(client.ws, { type: 'report_player_position', position: { x: 0.52, y: 0.31 } });

    const update = await gm.next(); // 位置上报触发广播
    expect(update.type).toBe('gm_update');
    expect(update.state.player.position).toEqual({ x: 0.52, y: 0.31 });

    gm.ws.close();
    client.ws.close();
  });

  test('GET /api/maps lists all viewable maps', async () => {
    const res = await httpGet('/api/maps');
    expect(res.status).toBe(200);
    const names = res.body.maps.map((m: any) => m.name);
    expect(names).toEqual(['Map001', 'Map002', 'Map003']);
    expect(names).not.toContain('Room001');
    const map001 = res.body.maps.find((m: any) => m.name === 'Map001');
    expect(map001.image).toBe('/maps/Map001.png');
  });
});
