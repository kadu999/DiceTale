// 静态服务器 + 自带后端拉起：本地预览 backend_tauri2/src 网页端。
// 用法：node scripts/serve.js [端口]   默认 1421
// 说明：页面里的 /api/maps、/items.json、/maps/*.png 来自自带后端（server/src/index.ts，默认 1420）。
//       serve.js 启动时会检测 1420 是否在运行；未运行则自动拉起自带后端（tsx 直跑，无需编译），
//       因此只需运行本脚本（或 serve-web.bat），网页打开即是完整可用的 GM 控制台。
const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');
const ROOT = path.join(PROJECT_ROOT, 'src');
const PORT = parseInt(process.argv[2] || process.env.PORT || '1421', 10);
const BACKEND_PORT = 1420;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  try {
    let url = decodeURIComponent((req.url || '/').split('?')[0]);
    if (url === '/') url = '/index.html';

    // 防止目录穿越
    const file = path.normalize(path.join(ROOT, url));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not Found: ' + url);
        return;
      }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    });
  } catch (e) {
    res.writeHead(500);
    res.end('Server error');
  }
});

// ---- 道具目录同步：src/items.json 是唯一来源，启动时同步一份给后端托管目录 ----
const serverPublicDir = path.join(PROJECT_ROOT, 'server', 'public');
const srcItemsJson = path.join(ROOT, 'items.json');
const dstItemsJson = path.join(serverPublicDir, 'items.json');
try {
  fs.mkdirSync(serverPublicDir, { recursive: true });
  fs.copyFileSync(srcItemsJson, dstItemsJson);
  console.log('[serve] 道具目录已同步: src/items.json -> server/public/items.json');
} catch (e) {
  console.warn('[serve] items.json 同步失败:', e.message);
}

// ---- 自带后端拉起（1420 未运行则自动启动，tsx 直跑无需编译） ----
let backendChild = null;

function isPortListening(port, cb) {
  const sock = net.connect(port, '127.0.0.1');
  const done = (ok) => {
    try { sock.destroy(); } catch (e) { /* ignore */ }
    cb(ok);
  };
  sock.on('connect', () => done(true));
  sock.on('error', () => done(false));
  sock.setTimeout(600, () => done(false));
}

function ensureBackend() {
  isPortListening(BACKEND_PORT, (open) => {
    if (open) {
      console.log(`[serve] 后端已在 ${BACKEND_PORT} 运行`);
      return;
    }
    const tsxCli = path.join(PROJECT_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
    if (!fs.existsSync(tsxCli)) {
      console.error(`[serve] 未找到 ${tsxCli}，无法启动自带后端。请先执行 npm install。`);
      return;
    }
    console.log(`[serve] 后端 ${BACKEND_PORT} 未运行，正在自动启动（tsx server/src/index.ts）...`);
    backendChild = spawn(process.execPath, [tsxCli, 'server/src/index.ts'], {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
    });
    backendChild.on('error', (err) => {
      console.error('[serve] 后端启动失败:', err.message);
      backendChild = null;
    });
    backendChild.on('exit', (code) => {
      console.log(`[serve] 后端进程已退出 (code=${code})`);
      backendChild = null;
    });
  });
}

// 关闭 serve 时一并结束自带后端（避免遗留孤儿进程）
function stopBackend() {
  if (backendChild) {
    try { backendChild.kill(); } catch (e) { /* ignore */ }
  }
}
process.on('exit', stopBackend);
['SIGINT', 'SIGTERM'].forEach((sig) => {
  process.on(sig, () => {
    stopBackend();
    process.exit(0);
  });
});

server.listen(PORT, () => {
  console.log(`[serve] 网页端: http://localhost:${PORT}/`);
  console.log(`[serve] 自带后端: http://localhost:${BACKEND_PORT}/ (未运行时自动拉起)`);
  ensureBackend();
});
