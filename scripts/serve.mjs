import http from 'node:http';
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const port = Number(process.env.PORT || 8000);
const mime = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.md':'text/plain', '.json':'application/json' };
const server = http.createServer(async (req, res) => {
  try {
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(ROOT, '.' + pathname.replaceAll('\\', '/'));
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end(); return; }
    const info = await stat(file);
    const target = info.isDirectory() ? path.join(file, 'index.html') : file;
    const bytes = await readFile(target);
    res.writeHead(200, { 'Content-Type': `${mime[path.extname(target)] || 'application/octet-stream'};charset=utf-8`,
      'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer',
      'Content-Security-Policy': "frame-ancestors 'none'" });
    res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); }
});
server.on('error', error => { console.error(error.message); process.exit(1); });
server.listen(port, '127.0.0.1', () => console.log(`R.M.C. → http://127.0.0.1:${server.address().port}\nCtrl+C to stop. This development server binds to localhost only.`));
