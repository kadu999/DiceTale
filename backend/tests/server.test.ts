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

  test('client-registered spawn points and objects appear in gm snapshot', async () => {
    const client = await connect('/client');
    openSockets.push(client.ws);
    send(client.ws, { type: 'request_join' });
    await client.next(); // sync_state

    send(client.ws, {
      type: 'register_map_objects',
      mapName: 'Map001',
      spawnPoints: [{ id: 'Default' }],
      objects: [{ id: 'Lever_1', kind: 'Lever', currentState: 'off', states: ['off', 'on'] }],
    });

    const gm = await connect('/gm');
    openSockets.push(gm.ws);
    const update = await gm.next(); // 客户端注册后广播的 gm_update

    expect(update.state.spawnPoints['Map001']).toEqual([{ id: 'Default' }]);
    expect(update.state.objects['Lever_1'].currentState).toBe('off');
  });

  test('request_teleport pushes teleport_player to client', async () => {
    const client = await connect('/client');
    openSockets.push(client.ws);
    send(client.ws, { type: 'request_join' });
    await client.next(); // sync_state

    send(client.ws, { type: 'request_teleport', mapName: 'Map002', spawnId: 'North' });

    const msg = await client.next();
    expect(msg.type).toBe('teleport_player');
    expect(msg.mapName).toBe('Map002');
    expect(msg.spawnId).toBe('North');
  });

  test('gm connects and receives initial gm_update', async () => {
    const gm = await connect('/gm');
    openSockets.push(gm.ws);
    const msg = await gm.next();
    expect(msg.type).toBe('gm_update');
    expect(msg.state.currentMap).toBeDefined();
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

  test('gm_set_object_state pushes set_object_state to connected client', async () => {
    const client = await connect('/client');
    openSockets.push(client.ws);
    send(client.ws, { type: 'request_join' });
    await client.next(); // sync_state

    const gm = await connect('/gm');
    openSockets.push(gm.ws);
    await gm.next(); // initial gm_update
    send(gm.ws, { type: 'gm_set_object_state', objectId: 'Door_1', state: 'open' });

    const msg = await client.next();
    expect(msg.type).toBe('set_object_state');
    expect(msg.objectId).toBe('Door_1');
    expect(msg.state).toBe('open');
  });

  test('register_map_objects objects appear in gm snapshot with state list', async () => {
    const client = await connect('/client');
    openSockets.push(client.ws);
    send(client.ws, { type: 'request_join' });
    await client.next(); // sync_state

    send(client.ws, {
      type: 'register_map_objects',
      mapName: 'Map001',
      spawnPoints: [{ id: 'Default' }],
      objects: [
        { id: 'Lever_1', name: '大厅拉杆', kind: 'Lever', currentState: 'off', states: ['off', 'on'], position: { x: 0.4, y: 0.3 } },
        { id: 'Door_2', name: '东侧门', kind: 'Door', currentState: 'closed', states: ['closed', 'open'], position: { x: 0.7, y: 0.5 } },
      ],
    });

    const gm = await connect('/gm');
    openSockets.push(gm.ws);
    const update = await gm.next(); // 注册后广播的 gm_update

    expect(update.state.objects['Lever_1']).toEqual({
      name: '大厅拉杆',
      kind: 'Lever',
      currentState: 'off',
      states: ['off', 'on'],
      mapName: 'Map001',
      position: { x: 0.4, y: 0.3 },
    });
    expect(update.state.objects['Door_2'].name).toBe('东侧门');
    expect(update.state.objects['Door_2'].currentState).toBe('closed');
    expect(update.state.objects['Door_2'].states).toEqual(['closed', 'open']);
    expect(update.state.objects['Door_2'].position).toEqual({ x: 0.7, y: 0.5 });
  });

  test('report_object_state updates snapshot and broadcasts gm_update', async () => {
    const client = await connect('/client');
    openSockets.push(client.ws);
    send(client.ws, { type: 'request_join' });
    await client.next(); // sync_state
    send(client.ws, {
      type: 'register_map_objects',
      mapName: 'Map001',
      spawnPoints: [],
      objects: [{ id: 'Lever_1', kind: 'Lever', currentState: 'off', states: ['off', 'on'] }],
    });

    const gm = await connect('/gm');
    openSockets.push(gm.ws);
    await gm.next(); // 初始 gm_update（已包含注册的对象）

    send(client.ws, { type: 'report_object_state', objectId: 'Lever_1', state: 'on' });

    const update = await gm.next();
    expect(update.type).toBe('gm_update');
    expect(update.state.objects['Lever_1'].currentState).toBe('on');
  });

  test('report_object_state for unknown object is ignored', async () => {
    const client = await connect('/client');
    openSockets.push(client.ws);
    send(client.ws, { type: 'request_join' });
    await client.next(); // sync_state

    const gm = await connect('/gm');
    openSockets.push(gm.ws);
    await gm.next(); // initial gm_update

    send(client.ws, { type: 'report_object_state', objectId: 'Missing', state: 'on' });

    let receivedUpdate = false;
    gm.ws.on('message', () => {
      receivedUpdate = true;
    });
    await new Promise((r) => setTimeout(r, 200));
    expect(receivedUpdate).toBe(false);
  });

  test('report_player_position updates gm snapshot', async () => {
    const client = await connect('/client');
    openSockets.push(client.ws);
    send(client.ws, { type: 'request_join' });
    await client.next(); // sync_state

    const gm = await connect('/gm');
    openSockets.push(gm.ws);
    await gm.next(); // initial gm_update

    send(client.ws, {
      type: 'report_player_position',
      playerId: 'Player_1',
      position: { x: 0.52, y: 0.31 },
      mapName: 'Map001',
    });

    const update = await gm.next(); // 位置上报触发广播
    expect(update.type).toBe('gm_update');
    expect(update.state.players['Player_1']).toEqual({
      name: 'Player_1',
      position: { x: 0.52, y: 0.31 },
      mapName: 'Map001',
    });

    gm.ws.close();
    client.ws.close();
  });

  test('register_players lists players in gm snapshot', async () => {
    const client = await connect('/client');
    openSockets.push(client.ws);
    send(client.ws, { type: 'request_join' });
    await client.next(); // sync_state

    send(client.ws, {
      type: 'register_players',
      players: [
        { id: 'Player_1', name: '小明' },
        { id: 'Player_2', name: '小红' },
      ],
    });

    const gm = await connect('/gm');
    openSockets.push(gm.ws);
    const update = await gm.next(); // 注册后广播的 gm_update

    expect(Object.keys(update.state.players).sort()).toEqual(['Player_1', 'Player_2']);
    expect(update.state.players['Player_2'].name).toBe('小红');

    gm.ws.close();
    client.ws.close();
  });

  test('client disconnect clears client data in gm snapshot', async () => {
    const client = await connect('/client');
    openSockets.push(client.ws);
    send(client.ws, { type: 'request_join' });
    await client.next(); // sync_state

    send(client.ws, { type: 'register_players', players: [{ id: 'Player_1', name: '小明' }] });
    send(client.ws, {
      type: 'register_map_objects',
      mapName: 'Map001',
      spawnPoints: [{ id: 'Default' }],
      objects: [{ id: 'Lever_1', name: '大厅拉杆', kind: 'Lever', currentState: 'off', states: ['off', 'on'] }],
    });

    const gm = await connect('/gm');
    openSockets.push(gm.ws);
    const update = await gm.next(); // 注册后广播
    expect(Object.keys(update.state.players)).toContain('Player_1');
    expect(Object.keys(update.state.objects)).toContain('Lever_1');
    expect(update.state.spawnPoints['Map001']).toEqual([{ id: 'Default' }]);

    // 客户端断开 → 后台清空玩家/对象/出生点并广播
    client.ws.close();
    const cleared = await gm.next();
    expect(cleared.state.players).toEqual({});
    expect(cleared.state.objects).toEqual({});
    expect(cleared.state.spawnPoints).toEqual({});

    gm.ws.close();
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
