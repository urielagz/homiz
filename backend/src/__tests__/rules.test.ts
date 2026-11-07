import { pool } from '../config/database.js';
import { api, bearer, closeDatabase, EMAILS, login, propertyId, resetDatabase } from './helpers.js';

/* Reglas de negocio de la fase 2 (decisiones 104–108). */

let admin: string, mariana: string, laura: string;
const at = (days: number, time: string) => {
  const d = new Date(Date.now() + days * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Cancun' });
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

describe('casas ocupadas y citas dobles', () => {
  const future = at(9, '10:00');

  test('nadie agenda visitas a una casa rentada: ni el inquilino, ni el broker, ni el sitio', async () => {
    const rented = await propertyId('ZUG-012');
    const byClient = await api().post('/api/v1/appointments').set(bearer(laura)).send({ propertyId: rented, scheduledAt: future.iso });
    expect(byClient.status).toBe(409);
    expect(byClient.body.error.code).toBe('NOT_AVAILABLE');
    const clientId = (await pool.query(`SELECT id FROM clients WHERE user_id = (SELECT id FROM users WHERE email = $1) LIMIT 1`, [EMAILS.laura])).rows[0].id;
    const byAdmin = await api().post('/api/v1/appointments').set(bearer(admin)).send({ propertyId: rented, clientId, scheduledAt: future.iso });
    expect(byAdmin.status).toBe(409);
    const mails = (await import('../services/mail.service.js')).sentMail;
    const before = mails.length;
    const site = await api().post('/api/v1/public/leads').send({ consent: true, reason: 'visita', name: 'Ana Visita', email: 'ana.visita@correo.com', propertyCode: 'ZUG-012', preferredDate: future.date, preferredTime: '10:00' });
    expect(site.status).toBe(409);
    expect(mails.length).toBe(before); // no se crea cuenta ni sale correo
  });

  test('rentar una casa cancela sus citas por venir y avisa a la persona', async () => {
    const id = await propertyId('ZUG-009');
    const a = await api().post('/api/v1/appointments').set(bearer(laura)).send({ propertyId: id, scheduledAt: at(10, '11:00').iso });
    expect([200, 201]).toContain(a.status);
    expect((await api().patch(`/api/v1/properties/${id}/availability`).set(bearer(admin)).send({ status: 'rentada' })).status).toBe(200);
    expect((await pool.query('SELECT status::text s FROM appointments WHERE id = $1', [a.body.id])).rows[0].s).toBe('cancelada');
    await api().patch(`/api/v1/properties/${id}/availability`).set(bearer(admin)).send({ status: 'disponible' });
  });

  test('el mismo correo no pide dos citas de la misma casa desde el sitio, pero sí otra solicitud', async () => {
    const lead = { consent: true, reason: 'visita', name: 'Bruno Doble', email: 'bruno.doble@correo.com', propertySlug: 'casa-zapote', preferredDate: at(11, '10:00').date, preferredTime: '12:00' };
    expect((await api().post('/api/v1/public/leads').send(lead)).status).toBe(201);
    const twice = await api().post('/api/v1/public/leads').send({ ...lead, preferredTime: '13:00' });
    expect(twice.status).toBe(409);
    expect(twice.body.error.code).toBe('ALREADY_SCHEDULED');
    expect((await api().post('/api/v1/public/leads').send({ consent: true, reason: 'rentar', name: 'Bruno Doble', email: 'bruno.doble@correo.com', propertySlug: 'casa-zapote', payload: {} })).status).toBe(201);
  });

  test('dos personas no agendan la misma casa a la misma hora', async () => {
    const id = await propertyId('ZUG-010');
    const when = at(12, '10:00');
    const a = await api().post('/api/v1/public/leads').send({ consent: true, reason: 'visita', name: 'Carla Uno', email: 'carla.uno@correo.com', propertyCode: 'ZUG-010', preferredDate: when.date, preferredTime: '10:00' });
    const b = await api().post('/api/v1/public/leads').send({ consent: true, reason: 'visita', name: 'Dante Dos', email: 'dante.dos@correo.com', propertyCode: 'ZUG-010', preferredDate: when.date, preferredTime: '10:00' });
    expect([a.status, b.status]).toEqual([201, 201]); // la solicitud se guarda; el asesor propone otro horario
    expect(a.body.appointmentCode).toEqual(expect.any(String));
    expect(b.body.appointmentCode).toBeNull();
    const { rows } = await pool.query(`SELECT count(*)::int n FROM appointments WHERE property_id = $1 AND status IN ('por-confirmar', 'confirmada')`, [id]);
    expect(rows[0].n).toBe(1);
  });
});

describe('horario de visitas, broker asignado, fechas y recibos', () => {
  test('solo se agenda de 7:00 a.m. a 11:00 p.m.', async () => {
    const id = await propertyId('ZUG-007');
    const early = await api().post('/api/v1/appointments').set(bearer(laura)).send({ propertyId: id, scheduledAt: at(14, '06:45').iso });
    expect(early.status).toBe(400);
    expect(early.body.error.message).toContain('7:00 a.m.');
    expect((await api().post('/api/v1/appointments').set(bearer(laura)).send({ propertyId: id, scheduledAt: at(14, '23:00').iso })).status).toBe(400);
    const site = await api().post('/api/v1/public/leads').send({ consent: true, reason: 'visita', name: 'Noche Tarde', email: 'noche.tarde@correo.com', propertyCode: 'ZUG-007', preferredDate: at(14, '10:00').date, preferredTime: '23:30' });
    expect(site.status).toBe(400);
    expect([200, 201]).toContain((await api().post('/api/v1/appointments').set(bearer(laura)).send({ propertyId: id, scheduledAt: at(14, '22:45').iso })).status);
  });

  test('el broker asignado a la persona atiende su cita aunque la casa sea de otro', async () => {
    const valeria = (await login('valeria@zugar.example')).accessToken;
    const c = (await pool.query(`SELECT id FROM clients WHERE user_id = (SELECT id FROM users WHERE email = $1)`, [EMAILS.laura])).rows[0].id;
    const vid = (await pool.query(`SELECT id FROM users WHERE email = 'valeria@zugar.example'`)).rows[0].id;
    await pool.query('UPDATE clients SET broker_id = $2 WHERE id = $1', [c, vid]);
    const house = (await pool.query(`SELECT id FROM properties WHERE broker_id <> $1 AND status = 'disponible' AND visibility = 'publicada' LIMIT 1`, [vid])).rows[0].id;
    const a = await api().post('/api/v1/appointments').set(bearer(laura)).send({ propertyId: house, scheduledAt: at(15, '11:00').iso });
    expect((await api().post(`/api/v1/appointments/${a.body.id}/confirm`).set(bearer(valeria))).status).toBe(200);
    await pool.query('UPDATE clients SET broker_id = NULL WHERE id = $1', [c]);
  });

  test('un contrato no empieza en una fecha que ya pasó', async () => {
    const id = await propertyId('ZUG-010');
    const c = (await pool.query(`SELECT id FROM clients WHERE email = 'dante.dos@correo.com' LIMIT 1`)).rows[0].id;
    const res = await api().post('/api/v1/contracts').set(bearer(admin)).send({ propertyId: id, clientId: c, startDate: at(-1, '10:00').date, endDate: at(400, '10:00').date, monthlyRent: 20000, paymentDay: 5 });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('ya pasó');
  });

  test('un contrato no empieza antes de la visita', async () => {
    const id = await propertyId('ZUG-010');
    const c = (await pool.query(`SELECT id FROM clients WHERE email = 'carla.uno@correo.com' LIMIT 1`)).rows[0].id;
    const today = at(0, '10:00').date, end = at(400, '10:00').date;
    const bad = await api().post('/api/v1/contracts').set(bearer(admin)).send({ propertyId: id, clientId: c, startDate: today, endDate: end, monthlyRent: 20000, paymentDay: 5 });
    expect(bad.status).toBe(400);
    expect(bad.body.error.message).toContain('antes de la visita');
  });

  test('al pagar un pagaré se genera su recibo; si se anula deja de verse', async () => {
    const note = (await pool.query(`SELECT n.id, n.amount FROM promissory_notes n JOIN contracts k ON k.id = n.contract_id JOIN clients c ON c.id = k.client_id JOIN users u ON u.id = c.user_id
       WHERE u.email = $1 AND n.status IN ('pending', 'overdue') ORDER BY n.number LIMIT 1`, [EMAILS.laura])).rows[0];
    const paid = await api().post(`/api/v1/promissory-notes/${note.id}/payments`).set(bearer(admin)).send({ amount: Number(note.amount), paidAt: new Date().toISOString() });
    expect(paid.status).toBe(201);
    expect(paid.body.proofDocumentId).toEqual(expect.any(String));
    // En «Fichas de cobro / Recibos» del inquilino: su recibo y la ficha de lo siguiente por pagar
    const tab = await api().get('/api/v1/receipts?pagares=1&limit=100').set(bearer(laura));
    expect(tab.status).toBe(200);
    expect(tab.body.data.find((r: { id: string }) => r.id === note.id)).toMatchObject({ kind: 'bill', status: 'paid', documentId: paid.body.proofDocumentId });
    expect(tab.body.data.some((r: { kind: string; concept: string }) => r.kind === 'charge_slip' && r.concept.startsWith('Ficha de cobro'))).toBe(true);
    const doc = (await pool.query('SELECT type, mime, visible_to_client, size FROM documents WHERE id = $1', [paid.body.proofDocumentId])).rows[0];
    expect(doc).toMatchObject({ type: 'receipt', mime: 'application/pdf', visible_to_client: true });
    const voided = await api().post(`/api/v1/promissory-notes/${note.id}/payments/${paid.body.payment.id}/void`).set(bearer(admin)).send({ reason: 'Prueba de anulación' });
    expect(voided.status).toBe(200);
    expect(voided.body.proofDocumentId).toBeNull();
  });
});

describe('el primero que atiende se queda con el seguimiento', () => {
  test('todos ven la solicitud libre; el primero la toma y los demás ya no', async () => {
    const valeria = (await login('valeria@zugar.example')).accessToken;
    const diego = (await login('diego@zugar.example')).accessToken;
    const sent = await api().post('/api/v1/public/leads').send({ consent: true, reason: 'rentar', name: 'Fernanda Libre', email: 'fernanda.libre@correo.com', payload: { zona: 'Cumbres' } });
    const id = (await pool.query('SELECT id FROM leads WHERE folio = $1', [sent.body.folio])).rows[0].id;
    const free = await api().get('/api/v1/leads?unassigned=true').set(bearer(valeria));
    expect(free.body.data.some((l: { id: string }) => l.id === id)).toBe(true);
    expect((await api().get(`/api/v1/leads/${id}`).set(bearer(diego))).status).toBe(200);

    const taken = await api().post(`/api/v1/leads/${id}/take`).set(bearer(valeria));
    expect(taken.status).toBe(200);
    expect(taken.body.broker.name).toContain('Valeria');
    const late = await api().post(`/api/v1/leads/${id}/take`).set(bearer(diego));
    expect(late.status).toBe(403);
    expect(late.body.error.message).toContain('Valeria');
    // Su siguiente solicitud ya llega con su broker
    const again = await api().post('/api/v1/public/leads').send({ consent: true, reason: 'comprar', name: 'Fernanda Libre', email: 'fernanda.libre@correo.com', payload: {} });
    const row = (await pool.query(`SELECT u.email FROM leads l JOIN users u ON u.id = l.broker_id WHERE l.folio = $1`, [again.body.folio])).rows[0];
    expect(row.email).toBe('valeria@zugar.example');
  });

  test('contestar o proponer una casa de otro también la toma; expediente y pagos siguen siendo de quien tiene la casa', async () => {
    const valeria = (await login('valeria@zugar.example')).accessToken;
    const sent = await api().post('/api/v1/public/leads').send({ consent: true, reason: 'rentar', name: 'Gael Propuesta', email: 'gael.propuesta@correo.com', payload: {} });
    const id = (await pool.query('SELECT id FROM leads WHERE folio = $1', [sent.body.folio])).rows[0].id;
    const vid = (await pool.query(`SELECT id FROM users WHERE email = 'valeria@zugar.example'`)).rows[0].id;
    const house = (await pool.query(`SELECT id FROM properties WHERE broker_id <> $1 AND status = 'disponible' AND visibility = 'publicada' LIMIT 1`, [vid])).rows[0].id;
    expect((await api().post(`/api/v1/leads/${id}/proposals`).set(bearer(valeria)).send({ propertyId: house })).status).toBeLessThan(300);
    expect((await pool.query('SELECT broker_id FROM leads WHERE id = $1', [id])).rows[0].broker_id).toBe(vid);
    expect((await api().get(`/api/v1/properties/${house}/dossier`).set(bearer(valeria))).status).toBe(403);
  });
});

describe('expediente y pagos: solo el administrador de la casa', () => {
  const permission = `(SELECT id FROM permissions WHERE code = 'properties.manage')`;
  const brokerRole = `(SELECT id FROM roles WHERE code = 'broker')`;
  afterAll(() => pool.query(`INSERT INTO role_permissions (role_id, permission_id) VALUES (${brokerRole}, ${permission}) ON CONFLICT DO NOTHING`));

  test('un broker normal no los lleva ni en su casa; un administrador solo en las que tiene asignadas; el propietario en todas', async () => {
    await pool.query(`DELETE FROM role_permissions WHERE role_id = ${brokerRole} AND permission_id = ${permission}`);
    const house = await propertyId('ZUG-012');
    const owned = (await pool.query('SELECT broker_id FROM properties WHERE id = $1', [house])).rows[0].broker_id;
    const brokerToken = mariana;
    expect((await pool.query('SELECT id FROM users WHERE email = $1', [EMAILS.mariana])).rows[0].id).toBe(owned);
    expect((await api().get(`/api/v1/properties/${house}/dossier`).set(bearer(brokerToken))).status).toBe(403);
    expect((await api().get(`/api/v1/promissory-notes?limit=5`).set(bearer(brokerToken))).body.data).toHaveLength(0);
    // Sigue viendo las casas para proponerlas
    expect((await api().get('/api/v1/properties?limit=100').set(bearer(brokerToken))).body.data.length).toBeGreaterThan(5);

    // Broker-administrador: la suya sí, la de otro no
    const adminRole = `(SELECT id FROM roles WHERE code = 'admin')`;
    await pool.query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, ${adminRole})`, [owned]);
    expect((await api().get(`/api/v1/properties/${house}/dossier`).set(bearer(brokerToken))).status).toBe(200);
    const other = (await pool.query('SELECT id FROM properties WHERE broker_id <> $1 LIMIT 1', [owned])).rows[0].id;
    expect((await api().get(`/api/v1/properties/${other}/dossier`).set(bearer(brokerToken))).status).toBe(403);
    await pool.query(`DELETE FROM user_roles WHERE user_id = $1 AND role_id = ${adminRole}`, [owned]);

    expect((await api().get(`/api/v1/properties/${other}/dossier`).set(bearer(admin))).status).toBe(200);
  });
});

describe('reportes en el inicio del personal', () => {
  test('siguen en el inicio mientras estén abiertos y salen solo al resolverse', async () => {
    const house = await propertyId('ZUG-012');
    const { rows: [r] } = await pool.query(`SELECT id FROM maintenance_reports WHERE property_id = $1 AND status NOT IN ('resolved', 'cancelled') LIMIT 1`, [house]);
    const seen = async () => (await api().get('/api/v1/dashboard').set(bearer(admin))).body.newReports.some((x: { id: string }) => x.id === r.id);
    await pool.query(`UPDATE maintenance_reports SET status = 'in_review' WHERE id = $1`, [r.id]);
    expect(await seen()).toBe(true);
    await pool.query(`UPDATE maintenance_reports SET status = 'in_repair' WHERE id = $1`, [r.id]);
    expect(await seen()).toBe(true);
    await pool.query(`UPDATE maintenance_reports SET status = 'resolved' WHERE id = $1`, [r.id]);
    expect(await seen()).toBe(false);
  });
});

describe('el cliente edita lo que mandó', () => {
  test('cambia sus datos sin perder los del sistema; cerrada ya no se edita; otra persona no puede', async () => {
    const made = await api().post('/api/v1/requests').set(bearer(laura)).send({ reason: 'rentar', message: 'Con jardín', payload: { zona: 'Arbolada', presupuesto_max: 15000 } });
    expect(made.status).toBe(201);
    const ok = await api().patch(`/api/v1/requests/${made.body.id}`).set(bearer(laura)).send({ message: 'Con alberca', payload: { zona: 'Cumbres', presupuesto_max: 20000, origen: 'otro' } });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ message: 'Con alberca', payload: { zona: 'Cumbres', presupuesto_max: 20000, origen: 'app' } });
    expect((await api().patch(`/api/v1/requests/${made.body.id}`).set(bearer(mariana)).send({ payload: {} })).status).toBe(403);
    await pool.query(`UPDATE leads SET status = 'cerrado' WHERE id = $1`, [made.body.id]);
    const closed = await api().patch(`/api/v1/requests/${made.body.id}`).set(bearer(laura)).send({ payload: {} });
    expect(closed.status).toBe(409);
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

describe('renta del dueño, cita acordada y casas ocupadas', () => {
  const contrato = async (token: string, propertyId: string, clientId: string, inicio: string) =>
    api().post('/api/v1/contracts').set(bearer(token)).send({ propertyId, clientId, startDate: inicio, endDate: at(400, '10:00').date, monthlyRent: 20000, paymentDay: 5 });

  test('administración no renta: solo el dueño', async () => {
    const house = await propertyId('ZUG-001');
    const { rows: [c] } = await pool.query(`SELECT id FROM clients WHERE active LIMIT 1`);
    const { rows: [v] } = await pool.query(`SELECT id FROM users WHERE email = $1`, [EMAILS.valeria]);
    await pool.query(`INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE code = 'admin' ON CONFLICT DO NOTHING`, [v.id]);
    const token = (await login(EMAILS.valeria)).accessToken;
    const res = await contrato(token, house, c.id, at(1, '10:00').date);
    await pool.query(`DELETE FROM user_roles WHERE user_id = $1 AND role_id = (SELECT id FROM roles WHERE code = 'admin')`, [v.id]);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('OWNER_ONLY');
  });

  test('«Hacer cita» confirma la fecha pedida; al rentar se cierra la solicitud del inquilino', async () => {
    const dia = at(9, '10:00');
    const lead = await api().post('/api/v1/public/leads').send({ consent: true, reason: 'visita', name: 'Elena Cita', email: 'elena.cita@correo.com', phone: '9981234567', propertySlug: 'casa-ceiba', preferredDate: dia.date, preferredTime: '10:00' });
    expect(lead.status).toBe(201);
    const leadId = lead.body.id ?? (await pool.query(`SELECT id FROM leads WHERE email = 'elena.cita@correo.com'`)).rows[0].id;
    await pool.query(`UPDATE appointments SET status = 'cancelada' WHERE lead_id = $1`, [leadId]);
    const house = (await pool.query(`SELECT property_id FROM leads WHERE id = $1`, [leadId])).rows[0].property_id;

    const otra = await api().post(`/api/v1/leads/${leadId}/appointment`).set(bearer(admin)).send({ propertyId: house, scheduledAt: at(9, '12:00').iso, agreed: true });
    expect(otra.status).toBe(400);

    const ok = await api().post(`/api/v1/leads/${leadId}/appointment`).set(bearer(admin)).send({ propertyId: house, scheduledAt: dia.iso, agreed: true });
    expect(ok.status).toBe(201);
    const { rows: [cita] } = await pool.query(`SELECT status, client_id FROM appointments WHERE id = $1`, [ok.body.appointment.id]);
    expect(cita.status).toBe('confirmada');

    expect((await contrato(admin, house, cita.client_id, dia.date)).status).toBe(201);
    const { rows: [l] } = await pool.query(`SELECT status FROM leads WHERE id = $1`, [leadId]);
    expect(l.status).toBe('cerrado');
  });

  test('una casa rentada no se propone ni se muestra en una solicitud abierta', async () => {
    const rentada = await propertyId('ZUG-012');
    const lead = await api().post('/api/v1/public/leads').send({ consent: true, reason: 'rentar', name: 'Oscar Busca', email: 'oscar.busca@correo.com', phone: '9981234568' });
    const { rows: [l] } = await pool.query(`SELECT id FROM leads WHERE email = 'oscar.busca@correo.com'`);
    expect(lead.status).toBe(201);
    const propuesta = await api().post(`/api/v1/leads/${l.id}/proposals`).set(bearer(admin)).send({ propertyId: rentada });
    expect(propuesta.status).toBe(409);
    expect(propuesta.body.error.code).toBe('NOT_AVAILABLE');

    await pool.query(`INSERT INTO lead_proposals (lead_id, property_id) VALUES ($1, $2)`, [l.id, rentada]);
    await pool.query(`UPDATE leads SET property_id = $2 WHERE id = $1`, [l.id, rentada]);
    const detalle = await api().get(`/api/v1/leads/${l.id}`).set(bearer(admin));
    expect(detalle.body.property).toBeNull();
    expect(detalle.body.proposals).toEqual([]);
    expect(detalle.body.proposalCount).toBe(0);
  });
});

describe('ventanas de la solicitud sin broker', () => {
  const OTHERS = [EMAILS.mariana, EMAILS.diego, EMAILS.valeria];
  let n = 0;
  const rewind = (id: string, minutes: number) => pool.query(`UPDATE leads SET created_at = now() - make_interval(mins => $2::int) WHERE id = $1`, [id, minutes]);
  const leadId = async (folio: string) => (await pool.query('SELECT id FROM leads WHERE folio = $1', [folio])).rows[0].id as string;
  const seen = async (token: string, id: string) =>
    (await api().get('/api/v1/leads?unassigned=true&limit=100').set(bearer(token))).body.data.some((l: { id: string }) => l.id === id);

  /** Cliente nuevo que pide visitar una casa en venta con asesor. */
  async function saleVisit() {
    const { rows: [h] } = await pool.query(
      `SELECT p.id, p.slug, u.name, u.email FROM properties p JOIN users u ON u.id = p.broker_id
        WHERE p.operation = 'venta' AND p.status = 'disponible' AND p.visibility = 'publicada' AND u.email = ANY($1) LIMIT 1`, [OTHERS]);
    n += 1;
    const sent = await api().post('/api/v1/public/leads').send({
      consent: true, reason: 'visita', name: `Nueva Clienta ${n}`, email: `nueva.clienta${n}@correo.com`, phone: '998 111 0000',
      propertySlug: h.slug, preferredDate: at(5 + n, '10:00').date, preferredTime: '10:00',
    });
    expect(sent.status).toBeLessThan(300);
    const other = OTHERS.find((e) => e !== h.email)!;
    return { id: await leadId(sent.body.folio), house: h, mine: (await login(h.email)).accessToken, other: (await login(other)).accessToken };
  }
  const generalLead = async () => {
    n += 1;
    const sent = await api().post('/api/v1/public/leads').send({ consent: true, reason: 'rentar', name: `General ${n}`, email: `general${n}@correo.com`, payload: {} });
    return leadId(sent.body.folio);
  };
  /** Valeria como administración y broker, igual que en producción. */
  const asAdmin = async <T>(run: (token: string) => Promise<T>) => {
    const { rows: [v] } = await pool.query(`SELECT id FROM users WHERE email = $1`, [EMAILS.valeria]);
    await pool.query(`INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE code = 'admin' ON CONFLICT DO NOTHING`, [v.id]);
    try {
      return await run((await login(EMAILS.valeria)).accessToken);
    } finally {
      await pool.query(`DELETE FROM user_roles WHERE user_id = $1 AND role_id = (SELECT id FROM roles WHERE code = 'admin')`, [v.id]);
    }
  };

  test('cliente nuevo y casa en venta: el asesor tiene la prioridad, los demás solo leen', async () => {
    const { id, house, mine, other } = await saleVisit();
    const seenByOther = await api().get(`/api/v1/leads/${id}`).set(bearer(other));
    expect(seenByOther.status).toBe(200);
    expect(seenByOther.body.broker).toBeNull();
    expect(seenByOther.body.priority.brokerName).toBe(house.name);

    const blocked = [
      await api().post(`/api/v1/leads/${id}/take`).set(bearer(other)),
      await api().post(`/api/v1/leads/${id}/proposals`).set(bearer(other)).send({ propertyId: house.id }),
      await api().post(`/api/v1/leads/${id}/messages`).set(bearer(other)).send({ body: 'Hola' }),
      await api().patch(`/api/v1/leads/${id}`).set(bearer(other)).send({ status: 'en_seguimiento' }),
      await api().post(`/api/v1/leads/${id}/appointment`).set(bearer(other)).send({ propertyId: house.id, scheduledAt: at(9, '11:00').iso }),
    ];
    for (const r of blocked) {
      expect(r.status).toBe(403);
      expect(r.body.error.code).toBe('LEAD_PRIORITY');
      expect(r.body.error.message).toContain(`Prioridad de ${house.name} hasta las`);
    }
    expect((await pool.query('SELECT broker_id FROM leads WHERE id = $1', [id])).rows[0].broker_id).toBeNull();

    const took = await api().post(`/api/v1/leads/${id}/take`).set(bearer(mine));
    expect(took.status).toBe(200);
    expect(took.body.broker.name).toBe(house.name);
    expect(took.body.priority).toBeNull();
  });

  test('el asesor que acepta la cita se queda con la solicitud', async () => {
    const { id, mine } = await saleVisit();
    const cita = (await pool.query('SELECT id FROM appointments WHERE lead_id = $1', [id])).rows[0].id;
    expect((await api().post(`/api/v1/appointments/${cita}/confirm`).set(bearer(mine))).status).toBeLessThan(300);
    expect((await pool.query('SELECT broker_id FROM leads WHERE id = $1', [id])).rows[0].broker_id).not.toBeNull();
  });

  test('pasadas las 2 horas pasa al pool y la toma otro broker; la dueña asigna en cualquier momento', async () => {
    const first = await saleVisit();
    await rewind(first.id, 121);
    expect((await api().get(`/api/v1/leads/${first.id}`).set(bearer(first.other))).body.priority).toBeNull();
    expect((await api().post(`/api/v1/leads/${first.id}/take`).set(bearer(first.other))).status).toBe(200);

    const second = await saleVisit();
    const { rows: [b] } = await pool.query(`SELECT id FROM users WHERE email = $1`, [EMAILS.diego]);
    expect((await api().patch(`/api/v1/leads/${second.id}/broker`).set(bearer(admin)).send({ brokerId: b.id })).status).toBe(200);
  });

  test('solicitud general: 30 minutos solo brokers y luego también administración', async () => {
    const id = await generalLead();
    const diego = (await login(EMAILS.diego)).accessToken;
    expect(await seen(diego, id)).toBe(true);
    await asAdmin(async (valeria) => {
      expect(await seen(valeria, id)).toBe(false);
      expect((await api().get(`/api/v1/leads/${id}`).set(bearer(valeria))).status).toBe(403);
      const take = await api().post(`/api/v1/leads/${id}/take`).set(bearer(valeria));
      expect(take.status).toBe(403);
      expect(take.body.error.code).toBe('LEAD_ADMIN_WAIT');
      await rewind(id, 31);
      expect(await seen(valeria, id)).toBe(true);
      expect((await api().post(`/api/v1/leads/${id}/take`).set(bearer(valeria))).status).toBe(200);
    });
  });

  test('dos brokers toman a la vez: solo uno se la queda', async () => {
    const id = await generalLead();
    const [a, b] = await Promise.all([login(EMAILS.mariana), login(EMAILS.diego)]);
    const res = await Promise.all([a, b].map((u) => api().post(`/api/v1/leads/${id}/take`).set(bearer(u.accessToken))));
    expect(res.map((r) => r.status).filter((s) => s === 200)).toHaveLength(1);
  });

  test('a las 4 horas avisa a la dueña una sola vez, al consultar', async () => {
    const id = await generalLead();
    await rewind(id, 241);
    const count = async () => Number((await pool.query(`SELECT count(*) FROM notifications WHERE type = 'lead_unattended' AND entity_id = $1`, [id])).rows[0].count);
    await api().get('/api/v1/leads?unassigned=true').set(bearer(mariana));
    await api().get('/api/v1/dashboard').set(bearer(mariana));
    expect(await count()).toBe(1);
    expect((await api().get(`/api/v1/leads/${id}`).set(bearer(admin))).body.overdue).toBe(true);
  });

  test('el cliente no recibe la prioridad ni el aviso', async () => {
    const mine = await api().get('/api/v1/requests').set(bearer(laura));
    expect(mine.status).toBe(200);
    for (const l of mine.body.data ?? mine.body) {
      expect(l).not.toHaveProperty('priority');
      expect(l).not.toHaveProperty('overdue');
    }
  });
});
