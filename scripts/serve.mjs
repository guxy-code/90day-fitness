import { createServer } from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const args = process.argv.slice(2);
const value = (flag, fallback) => args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback;
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)), value('--dir', 'dist'));
const port = Number(value('--port', process.env.PORT || '4173'));
const base = value('--base', '/90day-fitness/');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webmanifest': 'application/manifest+json', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const sourceMode = path.basename(root) !== 'dist';
async function devWorker() {
  const files = ['index.html'];
  const walk = async (directory, prefix) => {
    for (const entry of (await readdir(directory)).sort()) {
      const absolute = path.join(directory, entry);
      const relative = prefix + entry;
      if ((await stat(absolute)).isDirectory()) await walk(absolute, relative + '/');
      else if (relative !== 'sw.js') files.push(relative);
    }
  };
  await walk(path.join(root, 'src'), 'src/');
  await walk(path.join(root, 'public'), '');
  const hash = createHash('sha256');
  for (const file of files) {
    const location = file.startsWith('src/') || file === 'index.html' ? path.join(root, file) : path.join(root, 'public', file);
    hash.update(await readFile(location));
  }
  return (await readFile(path.join(root, 'public/sw.js'), 'utf8')).replaceAll('__CACHE_VERSION__', 'dev-' + hash.digest('hex').slice(0, 12)).replace('__PRECACHE_URLS__', JSON.stringify(files.map(file => './' + file)));
}
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === base.slice(0, -1)) { res.writeHead(302, { Location: base }); res.end(); return; }
    if (pathname.startsWith(base)) pathname = pathname.slice(base.length);
    else pathname = pathname.slice(1);
    if (pathname.includes('\0')) throw new Error('Invalid path');
    let file = path.resolve(root, pathname || 'index.html');
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end('Forbidden'); return; }
    if (sourceMode && pathname === 'sw.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(await devWorker());
      return;
    }
    try { await stat(file); }
    catch {
      if (!sourceMode) throw new Error('Not found');
      file = path.resolve(root, 'public', pathname);
      if (!file.startsWith(path.join(root, 'public') + path.sep)) throw new Error('Not found');
    }
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); }
});
server.listen(port, '0.0.0.0', () => console.log(`90day-fitness: http://localhost:${port}${base} (serving ${root})`));
