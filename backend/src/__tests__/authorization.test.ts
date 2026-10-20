import { pool } from '../config/database.js';
import { checkPropertyAccess } from '../services/access.service.js';
import type { AuthUser } from '../middlewares/authenticate.js';
import { api, bearer, closeDatabase, EMAILS, login, propertyId, resetDatabase } from './helpers.js';

let admin: string, mariana: string, laura: string;

beforeAll(async () => {
  await resetDatabase();
  admin = (await login(EMAILS.admin)).accessToken;
  mariana = (await login(EMAILS.mariana)).accessToken;
  laura = (await login(EMAILS.laura)).accessToken;
});
afterAll(closeDatabase);

describe('GET /activity-log por perfil', () => {
  test('sin sesión: 401', async () => {
    const res = await api().get('/api/v1/activity-log');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  test('cliente: 403 (no tiene el permiso activity.read)', async () => {
    const res = await api().get('/api/v1/activity-log').set(bearer(laura));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('administrador: ve todo el historial, incluidos los accesos', async () => {
    const res = await api().get('/api/v1/activity-log?limit=100').set(bearer(admin));
    expect(res.status).toBe(200);
    const codes = res.body.data.map((r: { property: { code: string } | null }) => r.property?.code);
    expect(codes).toEqual(expect.arrayContaining(['ZUG-001', 'ZUG-004']));
    expect(res.body.data.some((r: { action: string }) => r.action === 'login_success')).toBe(true);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 100 });
  });

  test('broker: solo el historial de sus propiedades', async () => {
    const res = await api().get('/api/v1/activity-log?limit=100').set(bearer(mariana));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    const { rows } = await pool.query(`SELECT code FROM properties WHERE broker_id = (SELECT id FROM users WHERE email = $1)`, [EMAILS.mariana]);
    const own = rows.map((r) => r.code);
    for (const r of res.body.data) expect(own).toContain(r.property.code);
    expect(res.body.data.some((r: { property: { code: string } }) => r.property.code === 'ZUG-004')).toBe(false);
  });

  test('broker: filtrar por una propiedad ajena da 403; por la suya, 200', async () => {
    const ajena = await api().get(`/api/v1/activity-log?propertyId=${await propertyId('ZUG-004')}`).set(bearer(mariana));
    expect(ajena.status).toBe(403);
    expect(ajena.body.error.code).toBe('NOT_OWNER');
    const propia = await api().get(`/api/v1/activity-log?propertyId=${await propertyId('ZUG-001')}`).set(bearer(mariana));
    expect(propia.status).toBe(200);
  });

  test('administrador: puede filtrar cualquier propiedad', async () => {
    const res = await api().get(`/api/v1/activity-log?propertyId=${await propertyId('ZUG-004')}`).set(bearer(admin));
    expect(res.status).toBe(200);
    expect(res.body.data[0].description).toBe('Diego marcó Casa de la Luz como reservada.');
  });

  test('propiedad inexistente: 404; identificador inválido: 400', async () => {
    expect((await api().get('/api/v1/activity-log?propertyId=00000000-0000-4000-8000-000000000000').set(bearer(admin))).status).toBe(404);
    const bad = await api().get('/api/v1/activity-log?propertyId=ZUG-001').set(bearer(admin));
    expect(bad.status).toBe(400);
    expect(bad.body.error.details).toHaveProperty('propertyId');
  });

  test('si se retira un permiso al rol, aplica de inmediato sin volver a iniciar sesión', async () => {
    await pool.query(
      `DELETE FROM role_permissions WHERE role_id = (SELECT id FROM roles WHERE code = 'broker')
         AND permission_id = (SELECT id FROM permissions WHERE code = 'activity.read')`,
    );
    const res = await api().get('/api/v1/activity-log').set(bearer(mariana));
    expect(res.status).toBe(403);
    expect(res.body.error.details.missingPermissions).toEqual(['activity.read']);
  });
});

describe('Pertenencia de propiedades (servicio)', () => {
  const asUser = async (email: string): Promise<AuthUser> => {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.type, c.id AS client_id,
              COALESCE(array_agg(r.code) FILTER (WHERE r.code IS NOT NULL), '{}') AS roles
         FROM users u
         LEFT JOIN clients c ON c.user_id = u.id
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id
        WHERE u.email = $1 GROUP BY u.id, c.id`,
      [email],
    );
    const u = rows[0];
    return { id: u.id, name: u.name, email: u.email, type: u.type, roles: u.roles, permissions: new Set(), clientId: u.client_id };
  };

  test('cliente: solo la casa que renta', async () => {
    const user = await asUser(EMAILS.laura);
    expect(await checkPropertyAccess(user, await propertyId('ZUG-012'))).toBe('ok');
    expect(await checkPropertyAccess(user, await propertyId('ZUG-001'))).toBe('forbidden');
  });

  test('broker: solo las casas donde es responsable; administrador: todas', async () => {
    const diego = await asUser(EMAILS.diego);
    expect(await checkPropertyAccess(diego, await propertyId('ZUG-004'))).toBe('ok');
    expect(await checkPropertyAccess(diego, await propertyId('ZUG-012'))).toBe('forbidden');
    const lucia = await asUser(EMAILS.admin);
    expect(await checkPropertyAccess(lucia, await propertyId('ZUG-012'))).toBe('ok');
  });
});

describe('Historial de solo inserción', () => {
  test('la base rechaza modificar o borrar registros', async () => {
    await expect(pool.query(`UPDATE activity_log SET action = 'x'`)).rejects.toThrow(/solo inserción/);
    await expect(pool.query('DELETE FROM activity_log')).rejects.toThrow(/solo inserción/);
  });
});
