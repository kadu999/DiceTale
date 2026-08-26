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

  test('catalog doors are seeded with positions in sync_state', async () => {
    const client = await connect('/client');
    openSockets.push(client.ws);
    send(client.ws, { type: 'request_join' });

    const msg = await client.next();
    expect(msg.type).toBe('sync_state');

    const door = msg.state.doors['Map001_Door_1'];
    expect(door).toBeDefined();
    expect(door.mapName).toBe('Map001');
    expect(door.position.x).toBeCloseTo(0.801, 2);
    expect(door.position.y).toBeCloseTo(0.477, 2);
    expect(door.isPortal).toBe(true);
    expect(door.targetMap).toBe('Map002');

    const bridge = msg.state.doors['Map001_Door_2'];
    expect(bridge).toBeDefined();
    expect(bridge.isPortal).toBe(false);
    expect(bridge.position.y).toBeCloseTo(0.589, 2);

    expect(msg.state.spawnPoints['Map001']).toEqual([{ id: 'Map001_001' }]);
    expect(msg.state.spawnPoints['Map003']).toEqual([{ id: 'Map003_001' }]);
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

    const gm = await connect('/gm');
    openSockets.push(gm.ws);
    await gm.next(); // initial gm_update

    send(gm.ws, { type: 'gm_open_door', doorId: 'Map001_Door_1' });
    const opened = await client.next();
    expect(opened.type).toBe('set_door_state');
    expect(opened.unlocked).toBe(true);

    send(gm.ws, { type: 'gm_close_door', doorId: 'Map001_Door_1' });
    const closed = await client.next();
    expect(closed.type).toBe('set_door_state');
    expect(closed.doorId).toBe('Map001_Door_1');
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
});
