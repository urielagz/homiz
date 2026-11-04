import { pool } from '../config/database.js';
import { api, bearer, closeDatabase, EMAILS, login, propertyId, resetDatabase } from './helpers.js';

/* Reglas de negocio de la fase 2 (decisiones 104–108). */

let admin: string, mariana: string, laura: string;
const at = (days: number, time: string) => {
  const d = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  return { date: d, iso: `${d}T${time}:00-05:00` };
};
const activeOf = async (email: string) =>
  (await pool.query(
    `SELECT a.id FROM appointments a JOIN clients c ON c.id = a.client_id JOIN users u ON u.id = c.user_id
      WHERE u.email = $1 AND a.status IN ('por-confirmar', 'confirmada') AND a.scheduled_at > now()`,
    [email],
  )).rows;

beforeAll(async () => {
  await resetDatabase();
  admin = (await login(EMAILS.admin)).accessToken;
  mariana = (await login(EMAILS.mariana)).accessToken;
  laura = (await login(EMAILS.laura)).accessToken;
});
afterAll(closeDatabase);

describe('propiedades sin borrador', () => {
  test('lo registrado queda disponible y pausado; «borrador» ya no se acepta', async () => {
    const res = await api().post('/api/v1/properties').set(bearer(mariana)).send({ name: 'Local Tulum Centro', type: 'Local comercial', operation: 'renta', price: 18000, zone: 'Centro' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'disponible', visibility: 'pausada', type: 'Local comercial' });
    const draft = await api().patch(`/api/v1/properties/${res.body.id}/availability`).set(bearer(mariana)).send({ status: 'borrador' });
    expect(draft.status).toBe(400);
  });

  test('no se aparta sin una visita realizada', async () => {
    const id = await propertyId('ZUG-001');
    await pool.query(`UPDATE appointments SET status = 'cancelada' WHERE property_id = $1 AND status = 'realizada'`, [id]);
    const res = await api().patch(`/api/v1/properties/${id}/availability`).set(bearer(mariana)).send({ status: 'reservada' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('VISIT_REQUIRED');
  });

  test('rentada sale del catálogo: queda pausada', async () => {
    const id = await propertyId('ZUG-011');
    const res = await api().patch(`/api/v1/properties/${id}/availability`).set(bearer(admin)).send({ status: 'rentada', visibility: 'publicada' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'rentada', visibility: 'pausada' });
  });

  test('cada persona tiene su ID (CLI-0001…)', async () => {
    const res = await api().get('/api/v1/clients?limit=50').set(bearer(admin));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const c of res.body.data) expect(c.code).toMatch(/^CLI-\d{4}$/);
  });
});

describe('una cita vigente por persona', () => {
  let first: string;

  test('pedir otra casa cambia la misma cita (no crea otra)', async () => {
    const a = await api().post('/api/v1/appointments').set(bearer(laura)).send({ propertyId: await propertyId('ZUG-001'), scheduledAt: at(5, '10:00').iso });
    expect(a.status).toBe(201);
    expect(a.body.moved).toBe(false);
    first = a.body.id;
    const b = await api().post('/api/v1/appointments').set(bearer(laura)).send({ propertyId: await propertyId('ZUG-008'), scheduledAt: at(6, '11:15').iso });
    expect(b.status).toBe(200);
    expect(b.body).toMatchObject({ id: first, moved: true, status: 'por-confirmar' });
    expect(b.body.property.code).toBe('ZUG-008');
    expect(await activeOf(EMAILS.laura)).toHaveLength(1);
    const act = await api().get('/api/v1/appointments/active').set(bearer(laura));
    expect(act.body.appointment.id).toBe(first);
  });

  test('el cliente ve el contacto de su asesor; la dirección exacta solo con la cita confirmada', async () => {
    const before = await api().get(`/api/v1/appointments/${first}`).set(bearer(laura));
    expect(before.body.broker).toMatchObject({ name: expect.any(String), email: expect.stringContaining('@') });
    expect(before.body.property).toMatchObject({ address: '', exactLocation: false, lat: null });
    const pid = await propertyId('ZUG-008');
    expect((await api().get(`/api/v1/properties/${pid}`).set(bearer(laura))).body).toMatchObject({ exactLocation: false, address: '' });

    expect((await api().post(`/api/v1/appointments/${first}/confirm`).set(bearer(admin))).status).toBe(200);
    const after = await api().get(`/api/v1/appointments/${first}`).set(bearer(laura));
    expect(after.body.property.exactLocation).toBe(true);
    expect(after.body.property.address).not.toBe('');
    expect((await api().get(`/api/v1/properties/${pid}`).set(bearer(laura))).body.exactLocation).toBe(true);
  });

  test('después de cancelar puede pedir otra cita', async () => {
    expect((await api().post(`/api/v1/appointments/${first}/cancel`).set(bearer(laura)).send({ reason: 'Cambio de planes' })).status).toBe(200);
    const again = await api().post('/api/v1/appointments').set(bearer(laura)).send({ propertyId: await propertyId('ZUG-001'), scheduledAt: at(7, '12:30').iso });
    expect(again.status).toBe(201);
    expect(again.body.id).not.toBe(first);
    expect(await activeOf(EMAILS.laura)).toHaveLength(1);
  });

  test('la solicitud del sitio de alguien con cita vigente cambia esa cita', async () => {
    const res = await api().post('/api/v1/public/leads').send({ consent: true,
      reason: 'visita', name: 'Laura Méndez', email: EMAILS.laura, propertySlug: 'casa-chaka', preferredDate: at(8, '10:00').date, preferredTime: '09:45',
    });
    expect(res.status).toBe(201);
    expect(await activeOf(EMAILS.laura)).toHaveLength(1);
  });
});

describe('«Cambiar mis datos» después de enviar', () => {
  test('correo equivocado: la cuenta pasa al correo correcto con contraseña temporal nueva', async () => {
    const sent = await api().post('/api/v1/public/leads').send({ consent: true, reason: 'rentar', name: 'Ana López', email: 'ana.lopez@gmial.com', payload: { presupuesto_max: 20000 } });
    expect(sent.status).toBe(201);
    expect(sent.body.account).toBe('created');
    expect(sent.body.editToken).toEqual(expect.any(String));

    const bad = await api().patch(`/api/v1/public/leads/${sent.body.folio}`).send({ token: sent.body.editToken.slice(0, -2) + 'aa', email: 'ana.lopez@gmail.com' });
    expect(bad.status).toBe(403);

    const fix = await api().patch(`/api/v1/public/leads/${sent.body.folio}`).send({ token: sent.body.editToken, email: 'ana.lopez@gmail.com', phone: '998 111 2233' });
    expect(fix.status).toBe(200);
    expect(fix.body).toMatchObject({ email: 'ana.lopez@gmail.com', account: 'created' });
    const users = (await pool.query(`SELECT email, must_change_password FROM users WHERE email ILIKE 'ana.lopez@%'`)).rows;
    expect(users).toEqual([{ email: 'ana.lopez@gmail.com', must_change_password: true }]);
    const lead = (await pool.query('SELECT email, phone FROM leads WHERE folio = $1', [sent.body.folio])).rows[0];
    expect(lead).toEqual({ email: 'ana.lopez@gmail.com', phone: '998 111 2233' });
  });

  test('si el correo correcto ya tiene cuenta, la solicitud pasa a esa cuenta y la equivocada se da de baja', async () => {
    const sent = await api().post('/api/v1/public/leads').send({ consent: true, reason: 'rentar', name: 'Laura Méndez', email: 'lau.mendez@correo.con', payload: {} });
    const fix = await api().patch(`/api/v1/public/leads/${sent.body.folio}`).send({ token: sent.body.editToken, email: EMAILS.laura });
    expect(fix.status).toBe(200);
    expect(fix.body.account).toBe('existing');
    const wrong = (await pool.query(`SELECT active FROM users WHERE id IN (SELECT user_id FROM clients WHERE email = 'lau.mendez@correo.con')`)).rows;
    expect(wrong.every((u) => u.active === false)).toBe(true);
    const owner = (await pool.query(`SELECT u.email FROM leads l JOIN clients c ON c.id = l.client_id JOIN users u ON u.id = c.user_id WHERE l.folio = $1`, [sent.body.folio])).rows[0];
    expect(owner.email).toBe(EMAILS.laura);
  });
});
