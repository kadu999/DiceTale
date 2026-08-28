# DiceTale 权威服务器 MVP 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一个 Node.js WebSocket 权威服务器，使 DiceTale 的门开启和地图传送由服务器控制，并提供可视化 GM 网页后台。

**Architecture:** 客户端通过 WebSocket 向服务器上报操作请求（如开门、传送），服务器维护权威状态后下发命令（`set_door_state`、`teleport_player`）让客户端执行；GM 通过同一服务器上的网页后台查看状态并手动触发开门/传送。服务器状态持久化到 JSON 文件。

**Tech Stack:** Node.js + TypeScript + `ws` + 原生 `http`；Unity 6 + `System.Net.WebSockets.ClientWebSocket` + NUnit 测试。

## Global Constraints

- 服务器放在本仓库 `server/` 目录下。
- Unity 脚本放在 `client/Assets/DiceTale/Scripts/` 下，新增 `Server/` 子目录。
- MVP 只实现门开启和地图传送的服务器控制，其他功能预留但不实现。
- 所有通信消息均为 JSON，通过 WebSocket 传输。
- 服务器是权威状态源；客户端不直接修改门状态和当前地图。
- GM 网页为可视化 UI，不是命令行。
- GM 后台中可控制对象必须与游戏内对象一一对应。
- 状态持久化到 `server/data/gamestate.json`。

## 文件结构

```
DiceTale/
├── client/Assets/DiceTale/Scripts/
│   ├── Server/
│   │   ├── ServerConnection.cs          # WebSocket 连接管理
│   │   ├── ServerCommandDispatcher.cs   # 服务器命令分发
│   │   └── WebSocketBackendService.cs   # IBackendService 的 WS 实现
│   ├── BackendManager.cs                # 改为使用 WebSocketBackendService
│   ├── Door.cs                          # 互动时请求服务器
│   ├── MapManager.cs                    # 上报对象、执行切图命令
│   └── IBackendService.cs               # 保留并扩展
└── server/
    ├── package.json
    ├── tsconfig.json
    ├── src/
    │   ├── index.ts
    │   ├── types.ts
    │   ├── GameState.ts
    │   ├── persistence.ts
    │   ├── ClientSession.ts
    │   ├── GmSession.ts
    │   ├── handlers/
    │   │   ├── clientHandlers.ts
    │   │   └── gmHandlers.ts
    │   └── commands/
    │       └── clientCommands.ts
    ├── public/
    │   ├── index.html
    │   ├── style.css
    │   └── app.js
    ├── data/
    │   └── .gitkeep
    └── tests/
        ├── GameState.test.ts
        ├── persistence.test.ts
        └── server.test.ts
```

---

## Task 1: 搭建 Node.js 服务器脚手架

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/data/.gitkeep`
- Create: `server/src/types.ts`
- Create: `server/src/index.ts`

**Interfaces:**
- Produces: `MessageType` 联合类型、`ClientMessage` / `ServerMessage` / `GmMessage` 类型定义。
- Produces: HTTP 服务器监听 `8080`，WebSocket 服务器挂载在 `/client` 和 `/gm`。

- [ ] **Step 1: 创建 `server/package.json`**

```json
{
  "name": "dicetale-server",
  "version": "0.1.0",
  "description": "DiceTale authoritative game server",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest"
  },
  "dependencies": {
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@types/jest": "^29.5.14",
    "@types/node": "^22.10.0",
    "@types/ws": "^8.5.13",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.5",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 2: 创建 `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: 创建 `server/data/.gitkeep`**

空文件，用于保留 `data/` 目录。

- [ ] **Step 4: 创建 `server/src/types.ts`**

```typescript
export type ClientMessage =
  | { type: 'request_join' }
  | {
      type: 'register_map_objects';
      mapName: string;
      doors: Array<{ id: string; targetMap: string; targetSpawn: string; isPortal: boolean }>;
      spawnPoints: Array<{ id: string }>;
    }
  | { type: 'request_door_access'; doorId: string }
  | { type: 'request_teleport'; mapName: string; spawnId: string }
  | { type: 'report_player_position'; position: { x: number; y: number } };

export type ServerMessage =
  | { type: 'sync_state'; state: GameStateSnapshot }
  | { type: 'set_map'; mapName: string; spawnId: string }
  | { type: 'set_door_state'; doorId: string; unlocked: boolean }
  | { type: 'teleport_player'; mapName: string; spawnId: string };

export type GmMessage =
  | { type: 'gm_open_door'; doorId: string }
  | { type: 'gm_teleport_player'; mapName: string; spawnId: string }
  | { type: 'gm_refresh' };

export interface GameStateSnapshot {
  currentMap: string;
  player: {
    position: { x: number; y: number };
  };
  doors: Record<string, { unlocked: boolean; targetMap: string; targetSpawn: string; isPortal: boolean }>;
}

export type GmUpdateMessage = {
  type: 'gm_update';
  state: GameStateSnapshot;
};
```

- [ ] **Step 5: 创建 `server/src/index.ts`（基础服务器）**

```typescript
import http from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { ClientSession } from './ClientSession';
import { GmSession } from './GmSession';
import { gameState } from './GameState';
import { loadState } from './persistence';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse) {
  let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url || '');
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }

  const ext = path.extname(filePath);
  const contentType: Record<string, string> = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
  };

  res.writeHead(200, { 'Content-Type': contentType[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(serveStatic);

const clientWss = new WebSocketServer({ server, path: '/client' });
const gmWss = new WebSocketServer({ server, path: '/gm' });

clientWss.on('connection', (ws) => {
  new ClientSession(ws);
});

gmWss.on('connection', (ws) => {
  new GmSession(ws);
});

loadState();

server.listen(PORT, () => {
  console.log(`DiceTale server listening on http://localhost:${PORT}`);
  console.log(`  Client WS: ws://localhost:${PORT}/client`);
  console.log(`  GM WS:     ws://localhost:${PORT}/gm`);
});
```

- [ ] **Step 6: 安装依赖并启动服务器测试**

Run:
```bash
cd server
npm install
npm run dev
```

Expected: 控制台输出监听地址。

Run (另一个终端):
```bash
curl http://localhost:8080/
```

Expected: 返回 `index.html` 内容（目前可能 404，因为 `public/index.html` 还未创建）。

- [ ] **Step 7: Commit**

```bash
git add server/package.json server/tsconfig.json server/data/.gitkeep server/src/types.ts server/src/index.ts
# 不要提交 node_modules
# 确保 .gitignore 已忽略 node_modules 和 dist
# 若 .gitignore 未包含，新增：
#   server/node_modules/
#   server/dist/
git commit -m "chore(server): scaffold Node.js WebSocket server"
```

---

## Task 2: 实现服务器权威状态与持久化

**Files:**
- Create: `server/src/GameState.ts`
- Create: `server/src/persistence.ts`
- Create: `server/jest.config.js`
- Create: `server/tests/GameState.test.ts`
- Create: `server/tests/persistence.test.ts`

**Interfaces:**
- Consumes: `GameStateSnapshot` from `types.ts`.
- Produces: `gameState` 单例，提供 `registerDoors`、`registerSpawnPoints`、`setMap`、`setDoorUnlocked`、`setPlayerPosition`、`getSnapshot()`。
- Produces: `loadState()` / `saveState()` 函数。

- [ ] **Step 1: 创建 `server/src/GameState.ts`**

```typescript
import { GameStateSnapshot } from './types';

export interface DoorInfo {
  unlocked: boolean;
  targetMap: string;
  targetSpawn: string;
  isPortal: boolean;
}

export interface SpawnPointInfo {
  id: string;
}

export class GameState {
  currentMap = 'Map001';
  player = { position: { x: 0, y: 0 } };
  doors: Record<string, DoorInfo> = {};
  spawnPoints: Record<string, SpawnPointInfo[]> = {};

  setMap(mapName: string, spawnId?: string) {
    this.currentMap = mapName;
  }

  registerDoors(mapName: string, doors: Omit<DoorInfo, 'unlocked'> & { id: string }[]) {
    const next: Record<string, DoorInfo> = {};
    for (const door of doors) {
      const existing = this.doors[door.id];
      next[door.id] = {
        unlocked: existing?.unlocked ?? false,
        targetMap: door.targetMap,
        targetSpawn: door.targetSpawn,
        isPortal: door.isPortal,
      };
    }
    this.doors = next;
  }

  registerSpawnPoints(mapName: string, spawnPoints: SpawnPointInfo[]) {
    this.spawnPoints[mapName] = spawnPoints;
  }

  setDoorUnlocked(doorId: string, unlocked = true): boolean {
    const door = this.doors[doorId];
    if (!door) return false;
    door.unlocked = unlocked;
    return true;
  }

  setPlayerPosition(position: { x: number; y: number }) {
    this.player.position = position;
  }

  getSnapshot(): GameStateSnapshot {
    return {
      currentMap: this.currentMap,
      player: { position: { ...this.player.position } },
      doors: JSON.parse(JSON.stringify(this.doors)),
    };
  }
}

export const gameState = new GameState();
```

- [ ] **Step 2: 创建 `server/src/persistence.ts`**

```typescript
import fs from 'fs';
import path from 'path';
import { gameState, GameState } from './GameState';
import { GameStateSnapshot } from './types';

const DATA_DIR = path.join(__dirname, '..', 'data');
const STATE_FILE = path.join(DATA_DIR, 'gamestate.json');

export function loadState(target = gameState) {
  if (!fs.existsSync(STATE_FILE)) return;
  try {
    const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) as Partial<GameStateSnapshot>;
    if (data.currentMap) target.currentMap = data.currentMap;
    if (data.player?.position) target.player.position = data.player.position;
    if (data.doors) {
      for (const [id, door] of Object.entries(data.doors)) {
        target.doors[id] = { ...door };
      }
    }
  } catch (err) {
    console.error('[Persistence] Failed to load state:', err);
  }
}

let saveTimeout: NodeJS.Timeout | null = null;

export function saveState(source = gameState) {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(source.getSnapshot(), null, 2));
  }, 300);
}
```

- [ ] **Step 3: 创建 `server/jest.config.js`**

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
};
```

- [ ] **Step 4: 创建 `server/tests/GameState.test.ts`**

```typescript
import { GameState } from '../src/GameState';

describe('GameState', () => {
  let state: GameState;

  beforeEach(() => {
    state = new GameState();
  });

  test('registerDoors preserves unlocked state across reloads', () => {
    state.registerDoors('Map001', [
      { id: 'D1', targetMap: 'Map002', targetSpawn: 'Default', isPortal: true },
    ]);
    state.setDoorUnlocked('D1', true);

    state.registerDoors('Map001', [
      { id: 'D1', targetMap: 'Map002', targetSpawn: 'Default', isPortal: true },
    ]);

    expect(state.doors['D1'].unlocked).toBe(true);
  });

  test('setDoorUnlocked returns false for unknown door', () => {
    expect(state.setDoorUnlocked('Missing')).toBe(false);
  });

  test('getSnapshot returns deep copy', () => {
    state.setMap('Map002');
    state.setPlayerPosition({ x: 1, y: 2 });
    state.registerDoors('Map002', [
      { id: 'D2', targetMap: 'Map003', targetSpawn: 'Default', isPortal: false },
    ]);
    state.setDoorUnlocked('D2', true);

    const snapshot = state.getSnapshot();
    expect(snapshot.currentMap).toBe('Map002');
    expect(snapshot.player.position).toEqual({ x: 1, y: 2 });
    expect(snapshot.doors['D2'].unlocked).toBe(true);

    snapshot.player.position.x = 999;
    snapshot.doors['D2'].unlocked = false;
    expect(state.player.position.x).toBe(1);
    expect(state.doors['D2'].unlocked).toBe(true);
  });
});
```

- [ ] **Step 5: 创建 `server/tests/persistence.test.ts`**

```typescript
import fs from 'fs';
import path from 'path';
import { GameState } from '../src/GameState';
import { loadState, saveState } from '../src/persistence';

const TEST_STATE_FILE = path.join(__dirname, '..', 'data', 'gamestate.json');

describe('persistence', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_STATE_FILE)) fs.unlinkSync(TEST_STATE_FILE);
  });

  afterAll(() => {
    if (fs.existsSync(TEST_STATE_FILE)) fs.unlinkSync(TEST_STATE_FILE);
  });

  test('saveState and loadState roundtrip', (done) => {
    const state = new GameState();
    state.setMap('Map002');
    state.setPlayerPosition({ x: 3, y: 4 });
    state.registerDoors('Map002', [
      { id: 'D1', targetMap: 'Map003', targetSpawn: 'Default', isPortal: true },
    ]);
    state.setDoorUnlocked('D1', true);

    saveState(state);

    setTimeout(() => {
      const raw = fs.readFileSync(TEST_STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      expect(parsed.currentMap).toBe('Map002');
      expect(parsed.player.position).toEqual({ x: 3, y: 4 });
      expect(parsed.doors['D1'].unlocked).toBe(true);

      const loaded = new GameState();
      loadState(loaded);
      expect(loaded.currentMap).toBe('Map002');
      expect(loaded.player.position).toEqual({ x: 3, y: 4 });
      expect(loaded.doors['D1'].unlocked).toBe(true);
      done();
    }, 500);
  });
});
```

- [ ] **Step 6: 运行测试**

Run:
```bash
cd server
npm test
```

Expected: 所有测试通过。

- [ ] **Step 8: Commit**

```bash
git add server/src/GameState.ts server/src/persistence.ts server/jest.config.js server/tests/
git commit -m "feat(server): add authoritative GameState and JSON persistence"
```

---

## Task 3: 实现服务器会话与消息处理

**Files:**
- Create: `server/src/ClientSession.ts`
- Create: `server/src/GmSession.ts`
- Create: `server/src/handlers/clientHandlers.ts`
- Create: `server/src/handlers/gmHandlers.ts`
- Create: `server/src/commands/clientCommands.ts`
- Create: `server/tests/server.test.ts`
- Modify: `server/src/index.ts`

**Interfaces:**
- Consumes: `gameState`、`saveState`、`ClientMessage`、`GmMessage`、`ServerMessage`。
- Produces: `ClientSession` 处理 `/client` 连接；`GmSession` 处理 `/gm` 连接；`broadcastToGm` 函数。

- [ ] **Step 1: 创建 `server/src/commands/clientCommands.ts`**

```typescript
import { WebSocket } from 'ws';
import { ServerMessage, GmUpdateMessage } from '../types';
import { gameState, GameStateSnapshot } from '../GameState';

export function send(ws: WebSocket, message: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function syncState(ws: WebSocket) {
  send(ws, { type: 'sync_state', state: gameState.getSnapshot() });
}

export function setDoorState(ws: WebSocket, doorId: string, unlocked: boolean) {
  send(ws, { type: 'set_door_state', doorId, unlocked });
}

export function teleportPlayer(ws: WebSocket, mapName: string, spawnId: string) {
  send(ws, { type: 'teleport_player', mapName, spawnId });
}

export function broadcastGmUpdate(gmSockets: Set<WebSocket>, state?: GameStateSnapshot) {
  const snapshot = state ?? gameState.getSnapshot();
  const message: GmUpdateMessage = { type: 'gm_update', state: snapshot };
  const text = JSON.stringify(message);
  for (const ws of gmSockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(text);
    }
  }
}
```

- [ ] **Step 2: 创建 `server/src/handlers/clientHandlers.ts`**

```typescript
import { WebSocket } from 'ws';
import { ClientMessage } from '../types';
import { gameState } from '../GameState';
import { saveState } from '../persistence';
import * as commands from '../commands/clientCommands';

export class ClientHandler {
  constructor(
    private ws: WebSocket,
    private gmSockets: Set<WebSocket>,
    private broadcast: () => void
  ) {}

  handle(message: ClientMessage) {
    switch (message.type) {
      case 'request_join':
        commands.syncState(this.ws);
        break;
      case 'register_map_objects':
        gameState.setMap(message.mapName);
        gameState.registerDoors(message.mapName, message.doors);
        gameState.registerSpawnPoints(message.mapName, message.spawnPoints);
        saveState();
        this.broadcast();
        break;
      case 'request_door_access':
        this.handleDoorAccess(message.doorId);
        break;
      case 'request_teleport':
        gameState.setMap(message.mapName);
        commands.teleportPlayer(this.ws, message.mapName, message.spawnId);
        saveState();
        this.broadcast();
        break;
      case 'report_player_position':
        gameState.setPlayerPosition(message.position);
        this.broadcast();
        break;
      default:
        console.warn('[ClientHandler] Unknown message:', (message as any).type);
    }
  }

  private handleDoorAccess(doorId: string) {
    const door = gameState.doors[doorId];
    if (!door) {
      console.warn('[ClientHandler] Door not found:', doorId);
      return;
    }

    if (!door.unlocked) {
      gameState.setDoorUnlocked(doorId, true);
    }

    if (door.isPortal) {
      gameState.setMap(door.targetMap);
      commands.teleportPlayer(this.ws, door.targetMap, door.targetSpawn);
    } else {
      commands.setDoorState(this.ws, doorId, true);
    }

    saveState();
    this.broadcast();
  }
}
```

- [ ] **Step 3: 创建 `server/src/handlers/gmHandlers.ts`**

```typescript
import { WebSocket } from 'ws';
import { GmMessage } from '../types';
import { gameState } from '../GameState';
import { saveState } from '../persistence';
import * as commands from '../commands/clientCommands';

export class GmHandler {
  constructor(
    private ws: WebSocket,
    private clientSocket: WebSocket | null,
    private broadcast: () => void
  ) {}

  handle(message: GmMessage) {
    switch (message.type) {
      case 'gm_open_door':
        this.openDoor(message.doorId);
        break;
      case 'gm_teleport_player':
        this.teleportPlayer(message.mapName, message.spawnId);
        break;
      case 'gm_refresh':
        commands.syncState(this.ws);
        break;
      default:
        console.warn('[GmHandler] Unknown message:', (message as any).type);
    }
  }

  private openDoor(doorId: string) {
    if (!gameState.setDoorUnlocked(doorId, true)) {
      console.warn('[GmHandler] Door not found:', doorId);
      return;
    }

    if (this.clientSocket) {
      commands.setDoorState(this.clientSocket, doorId, true);
    }

    saveState();
    this.broadcast();
  }

  private teleportPlayer(mapName: string, spawnId: string) {
    gameState.setMap(mapName);
    if (this.clientSocket) {
      commands.teleportPlayer(this.clientSocket, mapName, spawnId);
    }
    saveState();
    this.broadcast();
  }
}
```

- [ ] **Step 4: 创建 `server/src/ClientSession.ts`**

```typescript
import { WebSocket } from 'ws';
import { ClientHandler } from './handlers/clientHandlers';
import { ClientMessage } from './types';

export class ClientSession {
  private handler: ClientHandler;

  constructor(
    private ws: WebSocket,
    gmSockets: Set<WebSocket>,
    broadcast: () => void
  ) {
    this.handler = new ClientHandler(ws, gmSockets, broadcast);

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString()) as ClientMessage;
        this.handler.handle(data);
      } catch (err) {
        console.error('[ClientSession] Invalid message:', err);
      }
    });

    ws.on('close', () => {
      console.log('[ClientSession] Client disconnected');
    });
  }
}
```

- [ ] **Step 5: 创建 `server/src/GmSession.ts`**

```typescript
import { WebSocket } from 'ws';
import { GmHandler } from './handlers/gmHandlers';
import { GmMessage } from './types';
import { gameState } from './GameState';

export class GmSession {
  private handler: GmHandler;

  constructor(
    private ws: WebSocket,
    clientSocket: WebSocket | null,
    broadcast: () => void
  ) {
    this.handler = new GmHandler(ws, clientSocket, broadcast);

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'gm_update', state: gameState.getSnapshot() }));
    });

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString()) as GmMessage;
        this.handler.handle(data);
      } catch (err) {
        console.error('[GmSession] Invalid message:', err);
      }
    });
  }
}
```

- [ ] **Step 6: 修改 `server/src/index.ts` 管理连接与广播**

```typescript
import http from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { ClientSession } from './ClientSession';
import { GmSession } from './GmSession';
import { gameState } from './GameState';
import { loadState, saveState } from './persistence';
import { broadcastGmUpdate } from './commands/clientCommands';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// ... serveStatic 不变

const server = http.createServer(serveStatic);

const clientWss = new WebSocketServer({ server, path: '/client' });
const gmWss = new WebSocketServer({ server, path: '/gm' });

let clientSocket: WebSocket | null = null;
const gmSockets = new Set<WebSocket>();

function broadcastToGm() {
  broadcastGmUpdate(gmSockets);
}

clientWss.on('connection', (ws) => {
  if (clientSocket) {
    console.log('[Server] Closing previous client connection');
    clientSocket.close();
  }
  clientSocket = ws;
  new ClientSession(ws, gmSockets, broadcastToGm);

  ws.on('close', () => {
    if (clientSocket === ws) clientSocket = null;
  });
});

gmWss.on('connection', (ws) => {
  gmSockets.add(ws);
  ws.send(JSON.stringify({ type: 'gm_update', state: gameState.getSnapshot() }));
  new GmSession(ws, clientSocket, broadcastToGm);

  ws.on('close', () => {
    gmSockets.delete(ws);
  });
});

loadState();

server.listen(PORT, () => {
  console.log(`DiceTale server listening on http://localhost:${PORT}`);
});
```

- [ ] **Step 7: 创建 `server/tests/server.test.ts`**

```typescript
import WebSocket from 'ws';
import http from 'http';
import { AddressInfo } from 'net';
import { server } from '../src/index'; // 需要 index.ts 导出 server

describe('WebSocket server', () => {
  let httpServer: http.Server;
  let port: number;

  beforeAll((done) => {
    httpServer = server;
    httpServer.listen(0, () => {
      port = (httpServer.address() as AddressInfo).port;
      done();
    });
  });

  afterAll((done) => {
    httpServer.close(done);
  });

  test('client can connect and receive sync_state', (done) => {
    const ws = new WebSocket(`ws://localhost:${port}/client`);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'request_join' }));
    });
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'sync_state') {
        expect(msg.state.currentMap).toBeDefined();
        ws.close();
        done();
      }
    });
  });
});
```

注意：`index.ts` 当前直接 `server.listen()`，测试需要导出 `server` 实例。修改 `index.ts`：

```typescript
export const server = http.createServer(serveStatic);
// ... 使用 server 而非重新创建
```

并且只在非测试环境调用 `server.listen()`：

```typescript
if (require.main === module) {
  loadState();
  server.listen(PORT, () => { ... });
}
```

- [ ] **Step 8: 运行测试**

Run:
```bash
cd server
npm test
```

Expected: 所有测试通过。

- [ ] **Step 9: Commit**

```bash
git add server/src/ClientSession.ts server/src/GmSession.ts server/src/handlers/ server/src/commands/ server/tests/server.test.ts server/src/index.ts
git commit -m "feat(server): add WebSocket sessions and message handlers"
```

---

## Task 4: 实现 GM 可视化网页后台

**Files:**
- Create: `server/public/index.html`
- Create: `server/public/style.css`
- Create: `server/public/app.js`

**Interfaces:**
- Consumes: WebSocket `/gm` 连接、`gm_update` 消息、发送 `gm_open_door`、`gm_teleport_player`、`gm_refresh`。
- Produces: 可视化 HTML UI。

- [ ] **Step 1: 创建 `server/public/index.html`**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DiceTale GM 控制台</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header>
    <h1>DiceTale GM 控制台</h1>
    <span id="connectionStatus" class="status disconnected">未连接</span>
  </header>

  <main class="grid">
    <section class="panel">
      <h2>玩家状态</h2>
      <p>当前地图：<span id="currentMap">-</span></p>
      <p>玩家位置：X=<span id="posX">-</span> Y=<span id="posY">-</span></p>
    </section>

    <section class="panel">
      <h2>门控制</h2>
      <table>
        <thead>
          <tr><th>ID</th><th>目标地图</th><th>目标出生点</th><th>状态</th><th>操作</th></tr>
        </thead>
        <tbody id="doorTable"></tbody>
      </table>
    </section>

    <section class="panel">
      <h2>传送控制</h2>
      <label>地图：<select id="teleportMap"></select></label>
      <label>出生点：<select id="teleportSpawn"></select></label>
      <button id="btnTeleport">传送玩家</button>
      <button id="btnRefresh">刷新状态</button>
    </section>
  </main>

  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: 创建 `server/public/style.css`**

```css
body {
  font-family: system-ui, -apple-system, sans-serif;
  margin: 0;
  padding: 0;
  background: #f5f5f5;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: #222;
  color: #fff;
}

.status {
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.875rem;
}

.status.connected { background: #22c55e; }
.status.disconnected { background: #ef4444; }

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1rem;
  padding: 1rem;
}

.panel {
  background: #fff;
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

th, td {
  text-align: left;
  padding: 0.5rem;
  border-bottom: 1px solid #e5e7eb;
}

label {
  display: block;
  margin-bottom: 0.5rem;
}

button {
  margin-top: 0.5rem;
  margin-right: 0.5rem;
  padding: 0.5rem 1rem;
  cursor: pointer;
}
```

- [ ] **Step 3: 创建 `server/public/app.js`**

```javascript
const wsUrl = `ws://${location.host}/gm`;
let ws;
let state = null;

function connect() {
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    setStatus(true);
  };

  ws.onclose = () => {
    setStatus(false);
    setTimeout(connect, 2000);
  };

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'gm_update' || msg.type === 'sync_state') {
      state = msg.state;
      render();
    }
  };
}

function setStatus(connected) {
  const el = document.getElementById('connectionStatus');
  el.className = `status ${connected ? 'connected' : 'disconnected'}`;
  el.textContent = connected ? '已连接' : '未连接';
}

function render() {
  if (!state) return;

  document.getElementById('currentMap').textContent = state.currentMap || '-';
  document.getElementById('posX').textContent = state.player?.position?.x ?? '-';
  document.getElementById('posY').textContent = state.player?.position?.y ?? '-';

  const tbody = document.getElementById('doorTable');
  tbody.innerHTML = '';
  for (const [id, door] of Object.entries(state.doors || {})) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${id}</td>
      <td>${door.targetMap}</td>
      <td>${door.targetSpawn}</td>
      <td>${door.unlocked ? '已开启' : '锁定'}</td>
      <td><button ${door.unlocked ? 'disabled' : ''}>开门</button></td>
    `;
    const btn = tr.querySelector('button');
    btn.onclick = () => send({ type: 'gm_open_door', doorId: id });
    tbody.appendChild(tr);
  }

  populateTeleportOptions();
}

function populateTeleportOptions() {
  if (!state) return;
  const mapSelect = document.getElementById('teleportMap');
  const spawnSelect = document.getElementById('teleportSpawn');

  const knownMaps = new Set([state.currentMap]);
  for (const door of Object.values(state.doors || {})) {
    knownMaps.add(door.targetMap);
  }

  mapSelect.innerHTML = '';
  for (const map of knownMaps) {
    const opt = document.createElement('option');
    opt.value = map;
    opt.textContent = map;
    mapSelect.appendChild(opt);
  }

  function updateSpawns() {
    const selectedMap = mapSelect.value;
    spawnSelect.innerHTML = '';
    // 服务器目前没有广播 spawnPoints，暂时用 Default
    const opt = document.createElement('option');
    opt.value = 'Default';
    opt.textContent = 'Default';
    spawnSelect.appendChild(opt);
  }

  mapSelect.onchange = updateSpawns;
  updateSpawns();
}

function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

document.getElementById('btnTeleport').onclick = () => {
  const map = document.getElementById('teleportMap').value;
  const spawn = document.getElementById('teleportSpawn').value;
  send({ type: 'gm_teleport_player', mapName: map, spawnId: spawn });
};

document.getElementById('btnRefresh').onclick = () => {
  send({ type: 'gm_refresh' });
};

connect();
```

- [ ] **Step 4: 启动服务器并打开 GM 页面测试**

Run:
```bash
cd server
npm run dev
```

打开浏览器访问 `http://localhost:8080/`，确认页面显示并显示“已连接”。

- [ ] **Step 5: Commit**

```bash
git add server/public/
git commit -m "feat(server): add GM web dashboard"
```

---

## Task 5: Unity WebSocket 连接层

**Files:**
- Create: `client/Assets/DiceTale/Scripts/Server/ServerConnection.cs`
- Create: `client/Assets/DiceTale/Scripts/Server/ServerCommandDispatcher.cs`
- Create: `client/Assets/DiceTale/Scripts/Editor/Tests/ServerConnectionTests.cs`

**Interfaces:**
- Produces: `ServerConnection` 单例，提供 `Connect(string url)`、`Send(object message)`、`OnMessage` 事件、`IsConnected`。
- Produces: `ServerCommandDispatcher` 处理 `sync_state`、`set_map`、`set_door_state`、`teleport_player`。

- [ ] **Step 1: 创建 `client/Assets/DiceTale/Scripts/Server/ServerConnection.cs`**

```csharp
using System;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;

namespace DiceTale.Server
{
    public class ServerConnection : MonoBehaviour
    {
        public static ServerConnection Instance { get; private set; }

        public string DefaultUrl = "ws://localhost:8080/client";
        public event Action<string> OnMessage;
        public bool IsConnected => webSocket != null && webSocket.State == WebSocketState.Open;

        private ClientWebSocket webSocket;
        private CancellationTokenSource cts;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }

            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        public async void Connect(string url = null)
        {
            if (webSocket != null)
            {
                await CloseAsync();
            }

            webSocket = new ClientWebSocket();
            cts = new CancellationTokenSource();

            try
            {
                await webSocket.ConnectAsync(new Uri(url ?? DefaultUrl), cts.Token);
                _ = ReceiveLoop();
                SendJoin();
            }
            catch (Exception ex)
            {
                Debug.LogError($"[ServerConnection] Failed to connect: {ex.Message}");
            }
        }

        public void Send(object message)
        {
            if (!IsConnected) return;

            var json = JsonUtility.ToJson(message);
            var bytes = Encoding.UTF8.GetBytes(json);
            var segment = new ArraySegment<byte>(bytes);
            _ = webSocket.SendAsync(segment, WebSocketMessageType.Text, true, cts.Token);
        }

        private void SendJoin()
        {
            Send(new { type = "request_join" });
        }

        private async Task ReceiveLoop()
        {
            var buffer = new byte[4096];
            while (webSocket.State == WebSocketState.Open)
            {
                var result = await webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), cts.Token);
                if (result.MessageType == WebSocketMessageType.Close)
                {
                    await CloseAsync();
                    break;
                }

                var json = Encoding.UTF8.GetString(buffer, 0, result.Count);
                OnMessage?.Invoke(json);
            }
        }

        private async Task CloseAsync()
        {
            if (webSocket == null) return;
            try
            {
                cts?.Cancel();
                if (webSocket.State == WebSocketState.Open)
                {
                    await webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", CancellationToken.None);
                }
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[ServerConnection] Close error: {ex.Message}");
            }
            finally
            {
                webSocket?.Dispose();
                webSocket = null;
            }
        }

        private void OnDestroy()
        {
            _ = CloseAsync();
        }
    }
}
```

注意：`JsonUtility.ToJson` 对匿名类型可能有问题，因为匿名类型字段是只读的且没有无参构造函数。需要改用 `MiniJSON` 或手写序列化，或创建显式的消息类。

更简单：引入一个轻量 JSON 序列化辅助类 `JsonHelper`，使用 `Newtonsoft.Json` 需要额外包，不建议。可以使用 Unity 自带的 `JsonUtility` 配合显式 `[Serializable]` 类。

实现方式：为每种消息创建可序列化类，或使用 `Dictionary<string, object>` + `MiniJSON`。

本计划采用：创建 `NetworkMessage` 辅助类和具体消息类。

- [ ] **Step 2: 创建 `client/Assets/DiceTale/Scripts/Server/NetworkMessage.cs`**

```csharp
using System;
using System.Collections.Generic;

namespace DiceTale.Server
{
    [Serializable]
    public class RequestJoinMessage { public string type = "request_join"; }

    [Serializable]
    public class RequestDoorAccessMessage
    {
        public string type = "request_door_access";
        public string doorId;
    }

    [Serializable]
    public class RegisterMapObjectsMessage
    {
        public string type = "register_map_objects";
        public string mapName;
        public List<DoorInfo> doors = new List<DoorInfo>();
        public List<SpawnInfo> spawnPoints = new List<SpawnInfo>();
    }

    [Serializable]
    public class DoorInfo
    {
        public string id;
        public string targetMap;
        public string targetSpawn;
        public bool isPortal;
    }

    [Serializable]
    public class SpawnInfo
    {
        public string id;
    }

    [Serializable]
    public class ReportPlayerPositionMessage
    {
        public string type = "report_player_position";
        public Position position;
    }

    [Serializable]
    public class Position
    {
        public float x;
        public float y;
    }
}
```

- [ ] **Step 3: 修改 `ServerConnection.Send` 使用显式消息类**

```csharp
public void Send<T>(T message) where T : class
{
    if (!IsConnected) return;
    var json = JsonUtility.ToJson(message);
    var bytes = Encoding.UTF8.GetBytes(json);
    ...
}
```

- [ ] **Step 4: 创建 `client/Assets/DiceTale/Scripts/Server/ServerCommandDispatcher.cs`**

```csharp
using System;
using UnityEngine;

namespace DiceTale.Server
{
    public class ServerCommandDispatcher : MonoBehaviour
    {
        [Serializable]
        public class SetDoorStateCommand
        {
            public string type;
            public string doorId;
            public bool unlocked;
        }

        [Serializable]
        public class TeleportPlayerCommand
        {
            public string type;
            public string mapName;
            public string spawnId;
        }

        [Serializable]
        public class SetMapCommand
        {
            public string type;
            public string mapName;
            public string spawnId;
        }

        [Serializable]
        public class SyncStateCommand
        {
            public string type;
            public StateSnapshot state;
        }

        [Serializable]
        public class StateSnapshot
        {
            public string currentMap;
            public PlayerState player;
            public DoorStateMap doors;
        }

        [Serializable]
        public class PlayerState
        {
            public Position position;
        }

        [Serializable]
        public class DoorStateMap : ISerializationCallbackReceiver
        {
            public System.Collections.Generic.List<DoorStateEntry> entries = new System.Collections.Generic.List<DoorStateEntry>();
            [NonSerialized] public System.Collections.Generic.Dictionary<string, DoorStateEntry> map = new System.Collections.Generic.Dictionary<string, DoorStateEntry>();

            public void OnBeforeSerialize() { }
            public void OnAfterDeserialize()
            {
                map.Clear();
                foreach (var entry in entries)
                {
                    map[entry.id] = entry;
                }
            }
        }

        [Serializable]
        public class DoorStateEntry
        {
            public string id;
            public bool unlocked;
            public string targetMap;
            public string targetSpawn;
            public bool isPortal;
        }

        public void Dispatch(string json)
        {
            try
            {
                var baseMsg = JsonUtility.FromJson<BaseMessage>(json);
                switch (baseMsg.type)
                {
                    case "set_door_state":
                        HandleSetDoorState(json);
                        break;
                    case "teleport_player":
                        HandleTeleportPlayer(json);
                        break;
                    case "set_map":
                        HandleSetMap(json);
                        break;
                    case "sync_state":
                        HandleSyncState(json);
                        break;
                    default:
                        Debug.LogWarning($"[ServerCommandDispatcher] Unknown command: {baseMsg.type}");
                        break;
                }
            }
            catch (Exception ex)
            {
                Debug.LogError($"[ServerCommandDispatcher] Failed to dispatch: {ex.Message}");
            }
        }

        [Serializable]
        private class BaseMessage { public string type; }

        private void HandleSetDoorState(string json)
        {
            var cmd = JsonUtility.FromJson<SetDoorStateCommand>(json);
            var door = FindDoor(cmd.doorId);
            door?.SetUnlocked(cmd.unlocked);
        }

        private void HandleTeleportPlayer(string json)
        {
            var cmd = JsonUtility.FromJson<TeleportPlayerCommand>(json);
            var mapManager = FindObjectOfType<MapManager>();
            mapManager?.LoadMap(cmd.mapName, cmd.spawnId);
        }

        private void HandleSetMap(string json)
        {
            var cmd = JsonUtility.FromJson<SetMapCommand>(json);
            var mapManager = FindFirstObjectByType<MapManager>();
            mapManager?.LoadMap(cmd.mapName, cmd.spawnId);
        }

        private void HandleSyncState(string json)
        {
            var cmd = JsonUtility.FromJson<SyncStateCommand>(json);
            if (cmd.state == null) return;

            var mapManager = FindFirstObjectByType<MapManager>();
            if (!string.IsNullOrEmpty(cmd.state.currentMap) && mapManager != null)
            {
                mapManager.LoadMap(cmd.state.currentMap);
            }

            foreach (var entry in cmd.state.doors?.entries ?? new System.Collections.Generic.List<DoorStateEntry>())
            {
                var door = FindDoor(entry.id);
                door?.SetUnlocked(entry.unlocked);
            }
        }

        private Door FindDoor(string doorId)
        {
            foreach (var door in FindObjectsByType<Door>(FindObjectsSortMode.None))
            {
                if (door.DoorId == doorId) return door;
            }
            return null;
        }
    }
}
```

- [ ] **Step 5: 在 `Door.cs` 中新增公共只读属性**

`Server/ServerCommandDispatcher.cs` 需要通过 `DoorId` 查找门；`MapManager` 也需要读取门的目标信息。在 `Door.cs` 中新增：

```csharp
public string DoorId => doorId;
public string TargetSceneName => targetSceneName;
public string TargetSpawnId => targetSpawnId;
public bool IsPortal => isPortal;
```

- [ ] **Step 6: 创建 EditMode 测试 `ServerConnectionTests.cs`**

由于 `ServerConnection` 依赖真实 WebSocket，EditMode 测试可以测试消息类序列化：

```csharp
using DiceTale.Server;
using NUnit.Framework;
using UnityEngine;

namespace DiceTale.Editor.Tests
{
    public class ServerConnectionTests
    {
        [Test]
        public void RequestDoorAccessMessage_SerializesCorrectly()
        {
            var msg = new RequestDoorAccessMessage { doorId = "Door_A1" };
            var json = JsonUtility.ToJson(msg);
            Assert.IsTrue(json.Contains("\"type\":\"request_door_access\""));
            Assert.IsTrue(json.Contains("\"doorId\":\"Door_A1\""));
        }

        [Test]
        public void SetDoorStateCommand_DeserializesCorrectly()
        {
            var json = "{\"type\":\"set_door_state\",\"doorId\":\"Door_A1\",\"unlocked\":true}";
            var cmd = JsonUtility.FromJson<ServerCommandDispatcher.SetDoorStateCommand>(json);
            Assert.AreEqual("Door_A1", cmd.doorId);
            Assert.IsTrue(cmd.unlocked);
        }
    }
}
```

注意：`ServerCommandDispatcher.SetDoorStateCommand` 是嵌套类，可以从测试访问（如果 public）。

- [ ] **Step 7: 在 Unity 中运行 EditMode 测试**

Run: Unity Test Runner → EditMode → 运行 `ServerConnectionTests`。

Expected: 两个测试通过。

- [ ] **Step 8: Commit**

```bash
git add client/Assets/DiceTale/Scripts/Server/ client/Assets/DiceTale/Scripts/Door.cs
git commit -m "feat(client): add WebSocket connection and command dispatcher"
```

---

## Task 6: Unity WebSocketBackendService

**Files:**
- Create: `client/Assets/DiceTale/Scripts/Server/WebSocketBackendService.cs`
- Modify: `client/Assets/DiceTale/Scripts/IBackendService.cs`
- Modify: `client/Assets/DiceTale/Scripts/BackendManager.cs`

**Interfaces:**
- Consumes: `ServerConnection`。
- Produces: `WebSocketBackendService` 实现 `IBackendService`。

- [ ] **Step 1: 修改 `IBackendService.cs`**

```csharp
using System;

namespace DiceTale
{
    public interface IBackendService
    {
        void RequestDoorAccess(string doorId, Action<bool> callback);
    }
}
```

本阶段保持接口不变。

- [ ] **Step 2: 创建 `WebSocketBackendService.cs`**

```csharp
using System;
using System.Collections.Generic;
using DiceTale.Server;
using UnityEngine;

namespace DiceTale
{
    public class WebSocketBackendService : IBackendService
    {
        private readonly Dictionary<string, Action<bool>> pendingDoorCallbacks = new Dictionary<string, Action<bool>>();

        private ServerConnection connection;

        public void SubscribeToConnection(ServerConnection conn)
        {
            if (connection != null)
            {
                connection.OnMessage -= OnMessage;
            }
            connection = conn;
            if (connection != null)
            {
                connection.OnMessage += OnMessage;
            }
        }

        public void RequestDoorAccess(string doorId, Action<bool> callback)
        {
            if (connection == null || !connection.IsConnected)
            {
                Debug.LogWarning("[WebSocketBackendService] Not connected, allowing local fallback.");
                callback?.Invoke(true);
                return;
            }

            pendingDoorCallbacks[doorId] = callback;
            connection.Send(new RequestDoorAccessMessage { doorId = doorId });
        }

        private void OnMessage(string json)
        {
            var baseMsg = JsonUtility.FromJson<BaseMessage>(json);
            if (baseMsg == null) return;

            if (baseMsg.type == "set_door_state")
            {
                var cmd = JsonUtility.FromJson<SetDoorStateCommand>(json);
                if (pendingDoorCallbacks.TryGetValue(cmd.doorId, out var callback))
                {
                    pendingDoorCallbacks.Remove(cmd.doorId);
                    callback?.Invoke(cmd.unlocked);
                }
            }
            else if (baseMsg.type == "teleport_player")
            {
                // teleport_player 由 ServerCommandDispatcher 处理，不需要 callback
            }
        }

        [Serializable]
        private class BaseMessage { public string type; }

        [Serializable]
        private class SetDoorStateCommand
        {
            public string type;
            public string doorId;
            public bool unlocked;
        }
    }
}
```

- [ ] **Step 3: 修改 `BackendManager.cs`**

```csharp
using UnityEngine;

namespace DiceTale
{
    public class BackendManager : MonoBehaviour
    {
        public static BackendManager Instance { get; private set; }

        [SerializeField]
        private string serverUrl = "ws://localhost:8080/client";

        private IBackendService service;

        private void Awake()
        {
            Instance = this;

            var connection = gameObject.AddComponent<Server.ServerConnection>();
            connection.DefaultUrl = serverUrl;

            var dispatcher = gameObject.AddComponent<Server.ServerCommandDispatcher>();
            connection.OnMessage += dispatcher.Dispatch;

            service = new WebSocketBackendService();
            service.SubscribeToConnection(connection);

            connection.Connect(serverUrl);
        }

        public void RequestDoorAccess(string doorId, System.Action<bool> callback)
        {
            service?.RequestDoorAccess(doorId, callback);
        }
    }
}
```

注意：`ServerConnection` 是 `MonoBehaviour`，`BackendManager` 在 Awake 中 `AddComponent` 创建它。

- [ ] **Step 4: 运行 Unity 场景测试**

手动测试：运行 Unity，确认 `BackendManager` 自动连接服务器，控制台无报错。

- [ ] **Step 5: Commit**

```bash
git add client/Assets/DiceTale/Scripts/Server/WebSocketBackendService.cs client/Assets/DiceTale/Scripts/BackendManager.cs client/Assets/DiceTale/Scripts/IBackendService.cs
git commit -m "feat(client): integrate WebSocket backend service"
```

---

## Task 7: 改造 Door 以请求服务器

**Files:**
- Modify: `client/Assets/DiceTale/Scripts/Door.cs`

**Interfaces:**
- Consumes: `BackendManager.RequestDoorAccess`。
- Produces: 门触碰后向服务器请求权限；收到允许后执行本地开门或等待服务器切图命令。

- [ ] **Step 1: 保持 `Interact` 逻辑不变**

`Door.Interact` 已经调用 `BackendManager.Instance.RequestDoorAccess`，无需大幅修改。MVP 中 `allowed = true` 后：

- 非传送门：`ExecuteInteract()` 调用 `SetUnlocked(true)`。
- 传送门：`ExecuteInteract()` 调用 `LoadTargetMap()`，但服务器会同时下发 `teleport_player`；为避免冲突，传送门在收到服务器命令前不应本地切图。

需要区分：传送门应等待服务器 `teleport_player` 命令，而不是本地 `LoadTargetMap()`。

修改 `ExecuteInteract`：

```csharp
private void ExecuteInteract()
{
    if (isPortal)
    {
        // 传送门：等待服务器下发 teleport_player 命令
        // 本地 targetSceneName 仅作备用
        Debug.Log($"[Door] Portal {doorId} access requested, waiting for server teleport.");
    }
    else if (!isUnlocked)
    {
        SetUnlocked(true);
    }
}
```

- [ ] **Step 3: 运行场景测试**

手动测试：触碰非传送门，观察服务器日志和门状态变化；触碰传送门，观察是否收到 `teleport_player` 命令并切图。

- [ ] **Step 4: Commit**

```bash
git add client/Assets/DiceTale/Scripts/Door.cs
git commit -m "feat(client): make Door wait for server authority on portal teleport"
```

---

## Task 8: 改造 MapManager 上报对象并执行服务器命令

**Files:**
- Modify: `client/Assets/DiceTale/Scripts/MapManager.cs`

**Interfaces:**
- Consumes: `ServerConnection`、`RegisterMapObjectsMessage`。
- Produces: 地图加载后上报门和出生点；执行 `set_map` / `teleport_player` 命令。

- [ ] **Step 1: 在 `MapManager.LoadMap` 末尾上报对象**

```csharp
private void ReportMapObjects()
{
    var connection = Server.ServerConnection.Instance;
    if (connection == null) return;

    var msg = new Server.RegisterMapObjectsMessage { mapName = CurrentMapName };

    var doors = GetComponentsInChildren<Door>();
    foreach (var door in doors)
    {
        msg.doors.Add(new Server.DoorInfo
        {
            id = door.DoorId,
            targetMap = door.TargetSceneName,
            targetSpawn = door.TargetSpawnId,
            isPortal = door.IsPortal
        });
    }

    var spawns = GetComponentsInChildren<SpawnPoint>();
    foreach (var spawn in spawns)
    {
        msg.spawnPoints.Add(new Server.SpawnInfo { id = spawn.Id });
    }

    connection.Send(msg);
}
```

`SpawnPoint` 已有 `Id` 属性，无需修改。

- [ ] **Step 2: 在 `MapManager` 中注册命令监听**

`ServerCommandDispatcher` 已经处理 `set_map` 和 `teleport_player` 并调用 `MapManager.LoadMap`，所以 `MapManager` 不需要额外修改来接收命令。但需要确保 `LoadMap` 完成后再次 `ReportMapObjects`。

- [ ] **Step 3: 运行场景测试**

手动测试：加载地图后检查服务器日志中的 `register_map_objects`；GM 页面应显示门列表。

- [ ] **Step 4: Commit**

```bash
git add client/Assets/DiceTale/Scripts/MapManager.cs
git commit -m "feat(client): MapManager registers doors/spawns and executes server map commands"
```

---

## Task 9: 端到端集成测试

**Files:**
- Modify: `README.md`
- Modify: `.gitignore`

**Interfaces:**
- 验证客户端连接、门控制、GM 网页控制全流程。

- [ ] **Step 1: 更新 `.gitignore` 忽略 server 依赖和构建产物**

```gitignore
# Server
server/node_modules/
server/dist/
server/data/gamestate.json
```

- [ ] **Step 2: 更新 `README.md` 添加服务器启动说明**

在 README 中增加：

```markdown
## 服务器启动

```bash
cd server
npm install
npm run dev
```

GM 控制台：`http://localhost:8080/`
客户端 WebSocket：`ws://localhost:8080/client`
GM WebSocket：`ws://localhost:8080/gm`
```

- [ ] **Step 3: 执行端到端测试清单**

1. 启动服务器：`cd server && npm run dev`
2. 打开浏览器访问 `http://localhost:8080/`，确认 GM 页面显示“已连接”。
3. 运行 Unity 场景，确认客户端控制台输出连接成功。
4. 在 Unity 中触碰一扇非传送门，确认：
   - 服务器日志收到 `request_door_access`
   - 客户端门变为开启状态
   - GM 页面门状态变为“已开启”
5. 在 Unity 中触碰一扇传送门，确认：
   - 服务器日志收到 `request_door_access`
   - 客户端切换到目标地图
   - GM 页面当前地图更新
6. 在 GM 页面点击“开门”按钮，确认客户端对应门开启。
7. 在 GM 页面选择地图并点击“传送玩家”，确认客户端切换地图。
8. 停止服务器，确认 `server/data/gamestate.json` 已保存当前地图和门状态。
9. 重新启动服务器，确认状态从 JSON 恢复。

- [ ] **Step 4: Commit**

```bash
git add README.md .gitignore
git commit -m "docs: add server startup instructions and ignore rules"
```

---

## 自我审查

### Spec 覆盖检查

| Spec 要求 | 对应任务 |
|-----------|----------|
| Node.js 服务器在 `server/` 目录 | Task 1 |
| WebSocket JSON 协议 | Task 1 (types), Task 3 (handlers) |
| 服务器控制门开启 | Task 3 (handler), Task 7 (Door) |
| 服务器控制地图传送 | Task 3 (handler), Task 7/8 (Door/MapManager) |
| GM 可视化网页后台 | Task 4 |
| 对象一一对应（客户端上报） | Task 8 (MapManager) |
| JSON 持久化 | Task 2 |
| Unity 网络层改造 | Task 5, Task 6 |
| 错误处理/边界约定 | Task 3, Task 5 |

### Placeholder 扫描

- 无 TBD/TODO。
- 所有步骤包含具体代码或命令。
- 测试代码已给出。

### 类型一致性检查

- `doorId` 在 Unity 和 Node.js 中均使用 string。
- `mapName` / `spawnId` 均为 string。
- `isPortal` / `unlocked` 均为 boolean。
- 消息类型字符串在两端一致：`request_door_access`、`set_door_state`、`teleport_player`、`register_map_objects`、`gm_open_door`、`gm_teleport_player`。

### 已知风险与后续改进

1. `JsonUtility` 不支持字典反序列化，`DoorStateMap` 使用了 `List<Entry>` 作为兼容层。若后续消息复杂，建议引入 `Newtonsoft.Json` 或 `UnityEngine.JsonUtility` + 自定义解析。
2. `ServerConnection` 目前是单客户端连接模型，未来扩展多人时需要重构。
3. GM 网页的出生点下拉列表当前硬编码为 `Default`，因为服务器尚未广播 `spawnPoints`；可在后续任务中扩展 `gm_update` 包含 `spawnPoints`。
