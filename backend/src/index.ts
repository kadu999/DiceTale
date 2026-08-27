import http from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { ClientSession } from './ClientSession';
import { GmSession } from './GmSession';
import { gameState } from './GameState';
import { broadcastGmUpdate, send } from './commands/clientCommands';
import { config, BACKEND_ROOT } from './config';
import { listMaps, resolveMapAsset } from './mapAssets';

const PORT = config.port;
/** 地图贴图目录（后台自持副本）：*.png，见 backend/config.json */
const MAPS_DIR = config.mapsDir;
const PUBLIC_DIR = path.join(BACKEND_ROOT, 'public');

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

function serveFile(res: http.ServerResponse, filePath: string) {
  const ext = path.extname(filePath);
  res.writeHead(200, {
    'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream',
    // 开发控制台：静态资源不做缓存，改完刷新即生效
    'Cache-Control': 'no-cache',
  });
  fs.createReadStream(filePath).pipe(res);
}

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

/** 只读 API：GET /api/maps -> 所有可观看的地图图片列表 */
function handleApi(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  if (req.url === '/api/maps' && req.method === 'GET') {
    sendJson(res, 200, { maps: listMaps(MAPS_DIR) });
    return true;
  }
  return false;
}

/** /maps/{name}.png -> 后台地图贴图目录（MAPS_DIR，见 backend/config.json） */
function serveMapAsset(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  const match = /^\/maps\/([A-Za-z0-9_.-]+)$/.exec(req.url || '');
  if (!match) return false;

  const candidate = resolveMapAsset(MAPS_DIR, match[1]);
  if (candidate) {
    serveFile(res, candidate);
    return true;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Map asset not found');
  return true;
}

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse) {
  if (handleApi(req, res)) {
    return;
  }

  if (serveMapAsset(req, res)) {
    return;
  }

  // 剥离查询串（如 /app.js?v=1 应解析为 /app.js），避免命中 index.html 回退
  const urlPath = (req.url || '').split('?')[0];
  const resolvedPath = path.resolve(PUBLIC_DIR, '.' + urlPath);
  if (resolvedPath !== PUBLIC_DIR && !resolvedPath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  let filePath = resolvedPath;
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }

  serveFile(res, filePath);
}

export const server = http.createServer(serveStatic);

// 注意：不能在同一 http server 上创建多个带 path 的 WebSocketServer，
// 不匹配 path 的实例会以 400 中止握手。因此使用单个 WSS，按 URL 路由。
const wss = new WebSocketServer({ server });

let clientSocket: WebSocket | null = null;
const gmSockets = new Set<WebSocket>();

// 存活检测分两套（Unity 客户端的 WebSocketMessageType 无 Pong，不能依赖 ws 级 pong）：
// 1) GM 等浏览器连接：ws 级 ping/pong（浏览器自动应答 pong）；
// 2) Unity 客户端：应用层 heartbeat 消息（客户端约每 15s 上报，任意消息即视为存活），
//    超时未上报则 terminate，确保半开连接能被清理。
const HEARTBEAT_INTERVAL_MS = 30_000;
const CLIENT_IDLE_TIMEOUT_MS = 45_000;
let clientLastSeen = 0;
const isAlive = new WeakSet<WebSocket>();

function setupHeartbeat(ws: WebSocket) {
  isAlive.add(ws);
  ws.on('pong', () => {
    isAlive.add(ws);
  });
}

const heartbeatTimer = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws === clientSocket) continue; // Unity 客户端走应用层心跳
    if (!isAlive.has(ws)) {
      console.log('[Server] Heartbeat timeout, terminating connection');
      ws.terminate();
      continue;
    }
    isAlive.delete(ws);
    ws.ping();
  }

  if (clientSocket && Date.now() - clientLastSeen > CLIENT_IDLE_TIMEOUT_MS) {
    console.log('[Server] Client heartbeat timeout, terminating connection');
    clientSocket.terminate(); // close 处理器负责清空数据并广播
  }
}, HEARTBEAT_INTERVAL_MS);
// 不阻止进程退出（测试场景下 jest 需要进程能正常结束）
heartbeatTimer.unref();
server.on('close', () => clearInterval(heartbeatTimer));

function broadcastToGm() {
  broadcastGmUpdate(gmSockets, undefined, !!clientSocket);
}

wss.on('connection', (ws, req) => {
  // 必须挂 error 监听：ws 协议/发送错误会 emit('error')，无监听器时 EventEmitter 会抛出导致进程崩溃
  ws.on('error', (err) => {
    console.error('[Server] WebSocket error:', err.message);
  });
  setupHeartbeat(ws);

  const url = req.url ?? '';

  if (url.startsWith('/client')) {
    if (clientSocket) {
      console.log('[Server] Closing previous client connection');
      clientSocket.close();
    }
    clientSocket = ws;
    clientLastSeen = Date.now();
    // 任意客户端消息都视为存活（应用层心跳的兜底）
    ws.on('message', () => {
      clientLastSeen = Date.now();
    });
    new ClientSession(ws, broadcastToGm);
    broadcastToGm(); // 让 GM 页面立即感知客户端在线（clientConnected = true）

    ws.on('close', () => {
      if (clientSocket === ws) {
        clientSocket = null;
        // 客户端断开：清空其上报的运行时数据（玩家/对象/出生点），通知 GM 移除（单客户端架构）
        gameState.clearClientData();
        broadcastToGm();
        console.log('[Server] Client disconnected, client data cleared');
      }
    });
    return;
  }

  if (url.startsWith('/gm')) {
    gmSockets.add(ws);
    send(ws, { type: 'gm_update', state: gameState.getSnapshot(), clientConnected: !!clientSocket });
    new GmSession(ws, () => clientSocket, broadcastToGm);

    ws.on('close', () => {
      gmSockets.delete(ws);
    });
    return;
  }

  ws.close(1008, 'Unknown path');
});

if (require.main === module) {
  // 地图目录不存在时自动创建，保证 /api/maps 与 /maps/* 可用
  fs.mkdirSync(MAPS_DIR, { recursive: true });

  server.listen(PORT, () => {
    console.log(`DiceTale backend listening on http://localhost:${PORT}`);
    console.log(`  Client WS: ws://localhost:${PORT}/client`);
    console.log(`  GM WS:     ws://localhost:${PORT}/gm`);
    console.log(`  GM page:   http://localhost:${PORT}/`);
    console.log(`  Maps:      http://localhost:${PORT}/maps/Map001.png`);
    console.log(`  Maps API:  http://localhost:${PORT}/api/maps`);
    console.log(`  Maps dir:  ${MAPS_DIR} (backend/config.json 或环境变量 MAPS_DIR)`);
  });
}
