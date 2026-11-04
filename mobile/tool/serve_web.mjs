// Sirve una web ya compilada y reenvía /api a la API (puerto 3000), sin comprimir ni retener /api (el canal de
// tiempo real /api/v1/events llega al instante). Así funciona también publicada con un túnel (https://xxx.trycloudflare.com):
// un solo dominio, sin CORS.
// App Homiz (desde mobile/):        node tool/serve_web.mjs                      [PORT=5600]
// Sitio y panel (después de npm run build en web/):  ROOT=../web/dist PORT=5501 node tool/serve_web.mjs
// [API=http://localhost:3000]
import { createReadStream, statSync } from 'node:fs';
import { createServer, request } from 'node:http';
import { connect } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';

const HERE = fileURLToPath(new URL('..', import.meta.url));
const ROOT = resolve(HERE, process.env.ROOT ?? 'build/web');
const PORT = Number(process.env.PORT ?? 5600);
const API = new URL(process.env.API ?? 'http://localhost:3000');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.otf': 'font/otf', '.ttf': 'font/ttf', '.woff2': 'font/woff2',
};

function proxy(req, res) {
  // Se conserva el Host original: la API arma con él las direcciones de subida (que vuelven por este mismo servidor)
  const up = request({ host: API.hostname, port: API.port, path: req.url, method: req.method, headers: { ...req.headers, 'x-forwarded-host': req.headers.host ?? '' } }, (r) => {
    res.writeHead(r.statusCode ?? 502, r.headers);
    r.pipe(res);
  });
  up.on('error', () => {
    // Si la respuesta ya había empezado (p. ej. el canal en vivo al reiniciar la API), solo se corta
    if (res.headersSent) return res.destroy();
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { code: 'API_DOWN', message: 'No hay conexión con el servidor de Zugar.' } }));
  });
  req.pipe(up);
}

/**
 * Cabeceras de seguridad de las páginas (la API trae las suyas con Helmet):
 * - No se puede incrustar en otra página (clickjacking) y el navegador no adivina tipos de archivo.
 * - Por HTTPS (túnel o dominio), el navegador recuerda usar siempre HTTPS (HSTS).
 * - Sitio y panel (web/dist): política de contenido estricta; solo scripts propios y los de Firebase.
 *   La app Flutter carga su motor y fuentes de Google, así que su política es más amplia.
 */
const SITE = /[\\/]dist$/.test(ROOT);
function securityHeaders(req) {
  const local = /^(localhost|127\.0\.0\.1|192\.168\.)/.test(req.headers.host ?? '');
  const https = req.headers['x-forwarded-proto'] === 'https' || /trycloudflare\.com$/.test(req.headers.host ?? '');
  const api = local ? ' http://localhost:3000 ws://localhost:3000 http://127.0.0.1:3000' : '';
  const csp = SITE
    ? [
        "default-src 'self'",
        "script-src 'self' https://www.gstatic.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob: https:" + (local ? ' http://localhost:3000' : ''),
        "connect-src 'self' https: wss:" + api,
        "frame-src 'self'",
        "worker-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ].join('; ')
    : "frame-ancestors 'none'; object-src 'none'; base-uri 'self'";
  return {
    'content-security-policy': csp,
    'x-frame-options': 'DENY',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(self), microphone=(), geolocation=(self), payment=()',
    'cross-origin-opener-policy': 'same-origin-allow-popups',
    ...(https ? { 'strict-transport-security': 'max-age=31536000; includeSubDomains' } : {}),
  };
}

function file(req, res) {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let target = normalize(join(ROOT, path));
  if (!target.startsWith(ROOT)) return res.writeHead(403).end();
  try {
    if (statSync(target).isDirectory()) target = join(target, 'index.html');
  } catch {
    target = join(ROOT, 'index.html'); // rutas de la app (/home, /requests…): las resuelve la propia app
  }
  try {
    statSync(target);
  } catch {
    return res.writeHead(404).end();
  }
  // index.html y el service worker sin caché, para que una compilación nueva se vea al recargar
  const fresh = /index\.html$|flutter_service_worker\.js$|version\.json$/.test(target);
  const type = TYPES[extname(target)] ?? 'application/octet-stream';
  // Comprimido (main.dart.js pesa ~4 MB; con gzip, ~1 MB): carga mucho más rápido por el túnel
  const zip = /gzip/.test(req.headers['accept-encoding'] ?? '') && /javascript|json|html|css|svg|wasm|font|octet-stream/.test(type);
  res.writeHead(200, { ...securityHeaders(req), 'content-type': type, 'cache-control': fresh ? 'no-cache' : 'public, max-age=3600', vary: 'Accept-Encoding', ...(zip ? { 'content-encoding': 'gzip' } : {}) });
  const body = createReadStream(target);
  (zip ? body.pipe(createGzip({ level: 6 })) : body).pipe(res);
}

const server = createServer((req, res) => (req.url?.startsWith('/api/') ? proxy(req, res) : file(req, res)));

// WebSocket del tiempo real (/api/v1/ws): se reenvía la conexión tal cual a la API
server.on('upgrade', (req, socket, head) => {
  if (!req.url?.startsWith('/api/')) return socket.destroy();
  const up = connect(Number(API.port || 80), API.hostname, () => {
    const headers = Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n');
    up.write(`${req.method} ${req.url} HTTP/1.1\r\n${headers}\r\n\r\n`);
    if (head?.length) up.write(head);
    up.pipe(socket);
    socket.pipe(up);
  });
  const close = () => { up.destroy(); socket.destroy(); };
  up.on('error', close);
  socket.on('error', close);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`${ROOT} en http://localhost:${PORT} (API: ${API.origin}/api)`);
});
