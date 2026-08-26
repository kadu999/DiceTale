import http from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { ClientSession } from './ClientSession';
import { GmSession } from './GmSession';
import { gameState } from './GameState';
import { loadState } from './persistence';
import { broadcastGmUpdate } from './commands/clientCommands';

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

export const server = http.createServer(serveStatic);

// 注意：不能在同一 http server 上创建多个带 path 的 WebSocketServer，
// 不匹配 path 的实例会以 400 中止握手。因此使用单个 WSS，按 URL 路由。
const wss = new WebSocketServer({ server });

let clientSocket: WebSocket | null = null;
const gmSockets = new Set<WebSocket>();

function broadcastToGm() {
  broadcastGmUpdate(gmSockets);
}

wss.on('connection', (ws, req) => {
  const url = req.url ?? '';

  if (url.startsWith('/client')) {
    if (clientSocket) {
      console.log('[Server] Closing previous client connection');
      clientSocket.close();
    }
    clientSocket = ws;
    new ClientSession(ws, gmSockets, broadcastToGm);

    ws.on('close', () => {
      if (clientSocket === ws) clientSocket = null;
    });
    return;
  }

  if (url.startsWith('/gm')) {
    gmSockets.add(ws);
    ws.send(JSON.stringify({ type: 'gm_update', state: gameState.getSnapshot() }));
    new GmSession(ws, () => clientSocket, broadcastToGm);

    ws.on('close', () => {
      gmSockets.delete(ws);
    });
    return;
  }

  ws.close(1008, 'Unknown path');
});

loadState();

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`DiceTale server listening on http://localhost:${PORT}`);
    console.log(`  Client WS: ws://localhost:${PORT}/client`);
    console.log(`  GM WS:     ws://localhost:${PORT}/gm`);
    console.log(`  GM page:   http://localhost:${PORT}/`);
  });
}
