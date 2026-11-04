import type { AddressInfo } from 'node:net';
import { createServer, type Server } from 'node:http';
import { WebSocket } from 'ws';
import { attachWebSocket } from '../services/live.service.js';
import { app, bearer, closeDatabase, EMAILS, login, resetDatabase } from './helpers.js';

/* Tiempo real por WebSocket (decisión 109): cualquier escritura avisa al instante a las pantallas abiertas. */

let server: Server, base: string, token: string;

beforeAll(async () => {
  await resetDatabase();
  token = (await login(EMAILS.admin)).accessToken;
  server = createServer(app);
  attachWebSocket(server);
  await new Promise<void>((ok) => server.listen(0, ok));
  base = `127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise((ok) => server.close(ok));
  await closeDatabase();
});

const open = (t: string) => new WebSocket(`ws://${base}/api/v1/ws?token=${encodeURIComponent(t)}`);
const next = (ws: WebSocket) => new Promise<{ seq: number; scope: string }>((ok, fail) => {
  ws.once('message', (m) => ok(JSON.parse(String(m))));
  ws.once('error', fail);
});

test('sin token válido no se conecta', async () => {
  const ws = open('no-es-un-token');
  await expect(new Promise((ok, fail) => { ws.once('open', ok); ws.once('error', fail); ws.once('unexpected-response', (_q, r) => fail(new Error(String(r.statusCode)))); }))
    .rejects.toThrow();
});

test('al conectar recibe el contador y, al guardar algo, el aviso llega al instante', async () => {
  const ws = open(token);
  const hello = await next(ws);
  expect(hello.scope).toBe('hello');
  const pending = next(ws);
  const started = Date.now();
  const res = await fetch(`http://${base}/api/v1/public/leads`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consent: true, reason: 'otro', name: 'Prueba Tiempo Real', email: 'tiempo.real@example.com', message: 'Hola' }),
  });
  ws.close();
  expect(res.status).toBe(201);
  const msg = await pending;
  expect(msg.seq).toBeGreaterThan(hello.seq);
  expect(Date.now() - started).toBeLessThan(3000);
  expect(bearer(token)).toHaveProperty('Authorization');
});

test('una página ajena (otro origen) no se puede conectar aunque tenga un token', async () => {
  const ws = new WebSocket(`ws://${base}/api/v1/ws?token=${encodeURIComponent(token)}`, { headers: { Origin: 'https://sitio-malicioso.example' } });
  const status = await new Promise<number>((ok) => { ws.once('unexpected-response', (_q, r) => ok(r.statusCode ?? 0)); ws.once('open', () => { ws.close(); ok(101); }); ws.once('error', () => ok(-1)); });
  expect(status).toBe(403);
});
