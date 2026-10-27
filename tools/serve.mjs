// Local server: static files + the Edge Functions running under Node.
//   MOCK_META=1 node tools/serve.mjs        canned model answers, no key needed
//   MODEL_API_KEY=... node tools/serve.mjs   real Meta Model API
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const fnDir = join(root, 'netlify/edge-functions');
const handlers = new Map();
for (const file of await readdir(fnDir)) {
  if (!file.endsWith('.mjs')) continue;
  const mod = await import(join(fnDir, file));
  handlers.set(mod.config.path, mod.default);
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const port = Number(process.env.PORT || 8888);

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const handler = handlers.get(url.pathname);
  if (handler) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const hasBody = !['GET', 'HEAD'].includes(req.method);
    const response = await handler(new Request(url, { method: req.method, headers: req.headers, body: hasBody ? Buffer.concat(chunks) : undefined }));
    res.writeHead(response.status, Object.fromEntries(response.headers));
    return res.end(Buffer.from(await response.arrayBuffer()));
  }
  const file = resolve(root, '.' + (url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
}).listen(port, () => console.log(`Chairwise on http://localhost:${port} (${[...handlers.keys()].join(', ')})`));
