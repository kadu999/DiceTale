import http from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { ClientSession } from './ClientSession';
import { GmSession } from './GmSession';
import { gameState } from './GameState';
import { loadState } from './persistence';
import { broadcastGmUpdate } from './commands/clientCommands';
import { mapCatalog } from './mapCatalog';
import { loadGrid, saveGrid, seedGrids, gridFilePath } from './gridData';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const CLIENT_ASSETS_DIR = path.join(__dirname, '..', '..', 'client', 'Assets', 'DiceTale');
const SERVER_MAPS_DIR = path.join(__dirname, '..', 'data', 'maps');

/** 客户端地图资源目录：图片在 Res/Textures，旧网格数据在 Resources */
const MAP_SOURCE_DIRS = [
  path.join(CLIENT_ASSETS_DIR, 'Res', 'Textures'),
  path.join(CLIENT_ASSETS_DIR, 'Resources'),
];

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.bytes': 'application/octet-stream',
};

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(text);
}

function serveFile(res: http.ServerResponse, filePath: string) {
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}'));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

/** 网格编辑 API */
async function handleApi(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
  const url = req.url || '';

  const listMatch = /^\/api\/maps$/.exec(url);
  if (listMatch && req.method === 'GET') {
    const maps = mapCatalog.map((m) => {
      const grid = loadGrid(m.name);
      return {
        name: m.name,
        image: `/maps/${m.image}`,
        width: m.width,
        height: m.height,
        gridSizeX: grid?.gridSizeX ?? 0,
        gridSizeY: grid?.gridSizeY ?? 0,
        spawns: m.spawns,
        doors: m.doors,
      };
    });
    sendJson(res, 200, { maps });
    return true;
  }

  const gridMatch = /^\/api\/maps\/([A-Za-z0-9_-]+)\/grid$/.exec(url);
  if (gridMatch) {
    const name = gridMatch[1];

    if (req.method === 'GET') {
      const grid = loadGrid(name);
      if (!grid) {
        sendJson(res, 404, { error: `grid not found: ${name}` });
        return true;
      }
      sendJson(res, 200, grid);
      return true;
    }

    if (req.method === 'PUT') {
      try {
        const body = (await readJsonBody(req)) as { gridSizeX?: number; gridSizeY?: number; cells?: number[] };
        const data = {
          gridSizeX: body.gridSizeX ?? 0,
          gridSizeY: body.gridSizeY ?? 0,
          cells: body.cells ?? [],
        };
        if (!saveGrid(name, data)) {
          sendJson(res, 400, { error: 'invalid grid data' });
          return true;
        }
        sendJson(res, 200, { ok: true, name });
      } catch {
        sendJson(res, 400, { error: 'invalid JSON body' });
      }
      return true;
    }
  }

  return false;
}

/** /maps/{file}：服务器数据目录优先（可编辑网格），再回退客户端图片/旧数据 */
function serveMapAsset(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  const match = /^\/maps\/([A-Za-z0-9_.-]+)$/.exec(req.url || '');
  if (!match) return false;

  const fileName = match[1];
  const candidates = [path.join(SERVER_MAPS_DIR, fileName), ...MAP_SOURCE_DIRS.map((d) => path.join(d, fileName))];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      serveFile(res, candidate);
      return true;
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Map asset not found');
  return true;
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  if (await handleApi(req, res)) {
    return;
  }

  if (serveMapAsset(req, res)) {
    return;
  }

  let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url || '');
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }

  serveFile(res, filePath);
}

export const server = http.createServer(handleRequest);

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
gameState.seedFromCatalog();
seedGrids(mapCatalog.map((m) => m.name));

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`DiceTale server listening on http://localhost:${PORT}`);
    console.log(`  Client WS: ws://localhost:${PORT}/client`);
    console.log(`  GM WS:     ws://localhost:${PORT}/gm`);
    console.log(`  GM page:   http://localhost:${PORT}/`);
    console.log(`  Maps:      http://localhost:${PORT}/maps/Map001.png`);
    console.log(`  Grid API:  http://localhost:${PORT}/api/maps/Map001/grid`);
  });
}
