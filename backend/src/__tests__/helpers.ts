import { readFile } from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { pool } from '../config/database.js';
import { createApp } from '../app.js';

export const app = createApp();
export const api = () => request(app);
export const PASSWORD = 'Zugar2026!';

export const EMAILS = {
  admin: 'lucia@zugar.example',
  mariana: 'mariana@zugar.example',
  diego: 'diego@zugar.example',
  valeria: 'valeria@zugar.example',
  laura: 'lau.mendez@correo.com',
};

/** Borra la base de pruebas y vuelve a cargar esquema y datos de ejemplo. */
export async function resetDatabase(): Promise<void> {
  for (const file of ['001_schema.sql', '002_seed.sql']) {
    await pool.query(await readFile(path.resolve('db', file), 'utf8'));
  }
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}

export async function login(email: string, password = PASSWORD) {
  const res = await api().post('/api/v1/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`No se pudo iniciar sesión como ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as { accessToken: string; refreshToken: string; user: { id: string; roles: string[]; permissions: string[] } };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function propertyId(code: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>('SELECT id FROM properties WHERE code = $1', [code]);
  return rows[0].id;
}
