// Minimal static server for dist/, used by the screenshot and link scripts.
// Serves /path/ as /path/index.html and answers unknown paths with 404.html and status 404.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain', '.woff2': 'font/woff2', '.woff': 'font/woff', '.avif': 'image/avif', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.ico': 'image/x-icon' };

function serve(root, port = 0) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(root, url);
    if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
    if (url.endsWith('/')) file = path.join(file, 'index.html');
    else if (!path.extname(url) && fs.existsSync(path.join(file, 'index.html'))) { res.writeHead(301, { Location: `${url}/` }); res.end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) {
        fs.readFile(path.join(root, '404.html'), (e2, d2) => { res.writeHead(404, { 'Content-Type': TYPES['.html'] }); res.end(e2 ? 'Not found' : d2); });
        return;
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}
module.exports = { serve };
if (require.main === module) {
  const root = path.resolve(process.argv[2] || 'dist');
  serve(root, Number(process.argv[3] || 4321)).then(({ port }) => console.log(`Serving ${root} on http://127.0.0.1:${port}/`));
}
