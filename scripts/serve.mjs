import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { supabaseOrigin } from './security-policy.mjs';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.txt':'text/plain; charset=utf-8', '.json':'application/json' };
const allowed = new Set(['index.html','privacidad.html','terminos.html','normas.html','eliminar-cuenta.html','404.html','robots.txt','styles.css','theme.js','config.js','config.local.js','deletion.js','deletion-client.js','assets/seed.svg']);
const server = http.createServer(async (request, response) => {
  try {
    let relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/eternity\//, '').replace(/^\//, '');
    if (!relative) relative = 'index.html';
    if (!allowed.has(relative)) throw new Error('not_found');
    // The ignored override is available only through this loopback development server.
    const localOverride = await stat(path.join(root, '../config.local.js')).catch(() => null);
    const file = relative === 'config.js' && localOverride ? '../config.local.js' : relative;
    let content = await readFile(path.join(root, file));
    if (localOverride && path.extname(file) === '.html') {
      // Local test traffic stays on the shared loopback API; the artifact is never rewritten.
      content = content.toString('utf8').replace(`connect-src 'self' ${supabaseOrigin}`, "connect-src 'self' http://127.0.0.1:55321 http://localhost:55321");
    }
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store' });
    response.end(content);
  } catch {
    response.writeHead(404, { 'Content-Type':'text/html; charset=utf-8' });
    response.end(await readFile(path.join(root, '404.html')).catch(() => 'No encontrado'));
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Sitio local: http://127.0.0.1:${port}/eternity/`));
