// 零依赖静态服务器：本地预览 backend_tauri2/src 网页端（无需 python/node 框架）。
// 用法：node scripts/serve.js [端口]   默认 1421
// 说明：页面里的 /api/maps、/items.json、/maps/*.png 来自 Node 后端（默认 1420 端口），
//       打开页面后点右上角 ⚙ 填入后端地址（如 http://localhost:1420）即可连接。
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'src');
const PORT = parseInt(process.argv[2] || process.env.PORT || '1421', 10);

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

server.listen(PORT, () => {
  console.log(`[serve] 网页端: http://localhost:${PORT}/`);
  console.log(`[serve] 提示: 打开后点右上角 ⚙ 填入 Node 后端地址（默认 http://localhost:1420）`);
});
