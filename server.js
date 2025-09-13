const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;
const rootDir = path.resolve(__dirname);

const CONTENT_TYPE = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.mjs': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=UTF-8',
  '.wasm': 'application/wasm',
  '.map': 'application/json; charset=UTF-8',
  '.txt': 'text/plain; charset=UTF-8',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function safeJoin(base, target) {
  const resolved = path.resolve(base, target);
  if (!resolved.startsWith(base)) return null;
  return resolved;
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';

    const filePath = safeJoin(rootDir, pathname.slice(1));
    if (!filePath) return send(res, 400, 'Bad Request');

    fs.stat(filePath, (err, stats) => {
      if (err) {
        if (err.code === 'ENOENT') return send(res, 404, 'Not Found');
        return send(res, 500, 'Server Error');
      }
      let finalPath = filePath;
      if (stats.isDirectory()) finalPath = path.join(filePath, 'index.html');
      fs.readFile(finalPath, (readErr, data) => {
        if (readErr) {
          if (readErr.code === 'ENOENT') return send(res, 404, 'Not Found');
          return send(res, 500, 'Server Error');
        }
        const ext = path.extname(finalPath).toLowerCase();
        const type = CONTENT_TYPE[ext] || 'application/octet-stream';
        // Disable caching for now
        send(res, 200, data, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      });
    });
  } catch (e) {
    send(res, 500, 'Server Error');
  }
});

server.listen(PORT, () => {
  console.log(`Abalone server running at http://localhost:${PORT}`);
});

