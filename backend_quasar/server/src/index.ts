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
/** 地图贴图目录（后台自持副本）：*.png，见 server/config.json */
const MAPS_DIR = config.mapsDir;
/** 前端静态目录：托管 Quasar 构建产物 dist/spa */
const PUBLIC_DIR = path.resolve(__dirname, '../../dist/spa');
const INDEX_HTML = path.join(PUBLIC_DIR, 'index.html');

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
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
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function sendPlain(res: http.ServerResponse, status: number, text: string, headers: Record<string, string> = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(text);
}

/** 只读 API：GET /api/maps -> 所有可观看的地图图片列表 */
function handleApi(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  if (req.url === '/api/maps' && req.method === 'GET') {
    sendJson(res, 200, { maps: listMaps(MAPS_DIR) });
    return true;
  }
  return false;
}

/** /maps/{name}.png -> 后台地图贴图目录（MAPS_DIR，见 server/config.json） */
function serveMapAsset(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  // 先剥查询串（如 /maps/Map001.png?v=1）再解码，与 listMaps 的非 ASCII 文件名口径一致；
  // 字符集/扩展名限制集中在 resolveMapAsset（basename 防穿越 + .png 白名单）
  const urlPath = (req.url || '').split('?')[0];
  if (!urlPath.startsWith('/maps/')) return false;

  let fileName = '';
  try {
    fileName = decodeURIComponent(urlPath.slice('/maps/'.length));
  } catch {
    // 非法百分号编码：按找不到处理
  }
  const candidate = fileName ? resolveMapAsset(MAPS_DIR, fileName) : null;
  if (candidate) {
    serveFile(res, candidate);
    return true;
  }

  sendPlain(res, 404, 'Map asset not found');
  return true;
}

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse) {
  // 只读服务：非 GET/HEAD 一律 405
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendPlain(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
    return;
  }

  if (handleApi(req, res)) {
    return;
  }

  if (serveMapAsset(req, res)) {
    return;
  }

  // 未知 API 路径返回 404（JSON），避免回退到 index.html
  if ((req.url || '').startsWith('/api/')) {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  // 剥离查询串（如 /app.js?v=1 应解析为 /app.js），避免命中 index.html 回退
  const urlPath = (req.url || '').split('?')[0];
  const resolvedPath = path.resolve(PUBLIC_DIR, '.' + urlPath);
  if (resolvedPath !== PUBLIC_DIR && !resolvedPath.startsWith(PUBLIC_DIR + path.sep)) {
    sendPlain(res, 403, 'Forbidden');
    return;
  }

  let filePath = resolvedPath;
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    // 带扩展名的未命中路径直接 404（不吞成 SPA 回退，避免掩盖真实的资源缺失）；
    // 无扩展名路径才回退 index.html
    if (path.extname(urlPath)) {
      sendPlain(res, 404, 'Not found');
      return;
    }
    filePath = INDEX_HTML;
  }

  serveFile(res, filePath);
}

export const server = http.createServer(serveStatic);

// 启动失败（端口被占等）给出明确提示后退出，而不是裸抛堆栈或静默挂起
server.on('error', (err) => {
  const e = err as NodeJS.ErrnoException;
  if (e.code === 'EADDRINUSE') {
    console.error(`[Server] 端口 ${PORT} 已被占用：请修改 server/config.json 的 port，或关闭占用该端口的进程`);
  } else {
    console.error('[Server] HTTP server error:', err);
  }
  process.exit(1);
});

// 注意：不能在同一 http server 上创建多个带 path 的 WebSocketServer，
// 不匹配 path 的实例会以 400 中止握手。因此使用单个 WSS，按 URL 路由。
// maxPayload 来自配置（maxMessageMb）：单条 WS 消息大小上限（遮罩图等大消息）。
export const wss = new WebSocketServer({ server, maxPayload: config.maxMessageMb * 1024 * 1024 });

// 调试（可选）：打印所有 WS 升级请求（排查手机端 WebSocket 握手失败）。
// 默认关闭，由 server/config.json 的 debugWs 或环境变量 DEBUG_WS 开启。
if (config.debugWs) {
  server.on('upgrade', (req, socket) => {
    const h = req.headers;
    console.log(`[Server] WS upgrade: ${req.url} from ${req.socket.remoteAddress}`);
    console.log(`  upg=${h.upgrade} conn=${h.connection} ver=${h['sec-websocket-version']} key=${(h['sec-websocket-key'] || '').slice(0, 12)}... ext=${h['sec-websocket-extensions'] || '-'} origin=${h.origin || '-'}`);
    socket.on('close', () => console.log(`[Server] WS socket closed (${req.url})`));
    socket.on('error', (e) => console.log(`[Server] WS socket error: ${e.message}`));
  });
}

let clientSocket: WebSocket | null = null;
const gmSockets = new Set<WebSocket>();

// 存活检测分两套（Unity 客户端的 WebSocketMessageType 无 Pong，不能依赖 ws 级 pong）：
// 1) GM 等浏览器连接：ws 级 ping/pong（浏览器自动应答 pong）；
// 2) Unity 客户端：应用层 heartbeat 消息（客户端约每 15s 上报，任意消息即视为存活），
//    超时未上报则 terminate，确保半开连接能被清理。
const HEARTBEAT_INTERVAL_MS = 30_000;
const CLIENT_IDLE_TIMEOUT_MS = 45_000;
// 空闲计时跟随 socket：被替换的旧连接（僵尸）不会再给新客户端续命
const clientLastSeen = new WeakMap<WebSocket, number>();
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

  if (clientSocket && Date.now() - (clientLastSeen.get(clientSocket) ?? 0) > CLIENT_IDLE_TIMEOUT_MS) {
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
      // 直接 terminate：close() 的优雅握手在旧客户端不应答 close 帧时会停留在 CLOSING（最长 ~60s），
      // 期间旧连接的上报仍会写 gameState，与新客户端数据互相覆盖
      clientSocket.terminate();
    }
    clientSocket = ws;
    clientLastSeen.set(ws, Date.now());
    // 任意客户端消息都视为存活（应用层心跳的兜底）；只统计当前 socket 的消息
    ws.on('message', () => {
      clientLastSeen.set(ws, Date.now());
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
    console.log(`  Maps dir:  ${MAPS_DIR} (server/config.json 或环境变量 MAPS_DIR)`);
  });
}
