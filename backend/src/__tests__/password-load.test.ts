import argon2 from 'argon2';
import { hashPassword, needsRehash, passwordQueue, verifyPassword } from '../services/password.service.js';

/* Muchos inicios de sesión al mismo tiempo: la memoria no se dispara y nadie se queda sin respuesta. */

test('40 revisiones de contraseña simultáneas: máximo 2 a la vez, todas responden', async () => {
  const hash = await hashPassword('Prueba-2026');
  let peak = 0;
  const watch = setInterval(() => (peak = Math.max(peak, passwordQueue().running)), 1);
  const rssBefore = process.memoryUsage().rss;
  let rssPeak = rssBefore;
  const mem = setInterval(() => (rssPeak = Math.max(rssPeak, process.memoryUsage().rss)), 5);
  const started = Date.now();
  const results = await Promise.all(Array.from({ length: 40 }, (_, i) => verifyPassword(hash, i % 2 ? 'Prueba-2026' : 'Otra-2026')));
  const ms = Date.now() - started;
  clearInterval(watch);
  clearInterval(mem);
  expect(results.filter(Boolean)).toHaveLength(20);
  expect(peak).toBeLessThanOrEqual(2);
  expect(passwordQueue()).toMatchObject({ running: 0, waiting: 0 });
  console.log(`40 inicios de sesión simultáneos: ${ms} ms en total; memoria extra máxima ${Math.round((rssPeak - rssBefore) / 1024 / 1024)} MB`);
});

test('las contraseñas guardadas con los parámetros anteriores siguen sirviendo y se marcan para actualizarse', async () => {
  const old = await argon2.hash('Anterior-2026', { type: argon2.argon2id }); // 64 MiB, 3 pasadas
  expect(await verifyPassword(old, 'Anterior-2026')).toBe(true);
  expect(needsRehash(old)).toBe(true);
  expect(needsRehash(await hashPassword('Nueva-2026'))).toBe(false);
});
