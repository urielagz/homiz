import { pool } from '../config/database.js';
import { runDailyJobs } from '../jobs/daily.job.js';
import { api, bearer, closeDatabase, EMAILS, login, propertyId, resetDatabase } from './helpers.js';

/* Pruebas de los módulos de la Fase 2, en orden (comparten estado). */

let admin: string, mariana: string, diego: string, laura: string;
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4d50000000049454e44ae426082', 'hex');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

const future = (days: number, time = '10:00') => {
  const d = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  return { date: d, iso: `${d}T${time}:00-05:00` };
};
const notificationsOf = async (email: string, type: string) =>
  (await pool.query(`SELECT n.* FROM notifications n JOIN users u ON u.id = n.user_id WHERE u.email = $1 AND n.type = $2`, [email, type])).rows;

/** Pide URL firmada, sube el archivo y devuelve la clave. */
async function upload(token: string, propertyCode: string, purpose: string, mime: string, body: Buffer): Promise<string> {
  const pid = await propertyId(propertyCode);
  const u = await api().post('/api/v1/documents/upload-url').set(bearer(token)).send({ propertyId: pid, purpose, mime, size: body.length });
  expect(u.status).toBe(201);
  const put = await api().put(new URL(u.body.upload.url).pathname).set('Content-Type', mime).send(body);
  expect(put.status).toBe(201);
  return u.body.storageKey;
}

beforeAll(async () => {
  await resetDatabase();
  admin = (await login(EMAILS.admin)).accessToken;
  mariana = (await login(EMAILS.mariana)).accessToken;
  diego = (await login(EMAILS.diego)).accessToken;
  laura = (await login(EMAILS.laura)).accessToken;
});
afterAll(closeDatabase);

describe('Catálogo público y solicitudes del sitio', () => {
  test('filtra con los parámetros del sitio y no expone contacto del broker', async () => {
    const res = await api().get('/api/v1/public/properties?operacion=renta&recamaras=3&precio_max=40000');
    expect(res.status).toBe(200);
    expect(res.body.data.map((p: { name: string }) => p.name)).toEqual(['Casa Zapote', 'Casa Ceiba', 'Casa Chaká', 'Casa Nativa', 'Casa Ramón', 'Casa Huano']);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 6, total: 6 });
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/broker|@zugar\.example|555 01/);
    expect(res.body.data[1]).toMatchObject({ slug: 'casa-ceiba', op: 'renta', zonaKey: 'arbolada', asesor: 'Mariana Solís' });
  });

  test('ficha pública: solo casas publicadas', async () => {
    expect((await api().get('/api/v1/public/properties/casa-ceiba')).status).toBe(200);
    expect((await api().get('/api/v1/public/properties/casa-almendra')).status).toBe(404); // borrador
  });

  test('una solicitud de visita devuelve folio y crea la cita por confirmar para el broker', async () => {
    const f = future(10);
    const res = await api().post('/api/v1/public/leads').send({
      reason: 'visita', name: 'Pedro Solano', email: 'pedro.solano@correo.com', phone: '998 123 4567', propertySlug: 'casa-ceiba',
      preferredDate: f.date, preferredTime: '11:30', message: 'Me interesa el jardín.', payload: { personas: '3', mascotas: 'no' },
    });
    expect(res.status).toBe(201);
    expect(res.body.folio).toMatch(/^Z-\d{5}$/);
    expect(res.body.appointmentCode).toMatch(/^CIT-\d{3}$/);
    const { rows } = await pool.query(`SELECT status FROM appointments WHERE code = $1`, [res.body.appointmentCode]);
    expect(rows[0].status).toBe('por-confirmar');
    expect((await notificationsOf(EMAILS.mariana, 'appointment_requested')).length).toBeGreaterThan(0);
  });

  test('rechaza fechas pasadas y motivos inválidos', async () => {
    const past = await api().post('/api/v1/public/leads').send({ reason: 'visita', name: 'Pedro Solano', email: 'p@correo.com', propertySlug: 'casa-ceiba', preferredDate: '2020-01-01', preferredTime: '10:00' });
    expect(past.status).toBe(400);
    expect(past.body.error.details).toHaveProperty('preferredDate');
    const bad = await api().post('/api/v1/public/leads').send({ reason: 'regalar', name: 'X Y', email: 'p@correo.com' });
    expect(bad.status).toBe(400);
  });

  test('el broker ve las solicitudes de sus casas y las generales, y puede darles seguimiento', async () => {
    const list = await api().get('/api/v1/leads').set(bearer(mariana));
    expect(list.status).toBe(200);
    const reasons = list.body.data.map((l: { reason: string }) => l.reason);
    expect(reasons).toEqual(expect.arrayContaining(['visita', 'publicar']));
    const lead = list.body.data.find((l: { reason: string }) => l.reason === 'publicar');
    const upd = await api().patch(`/api/v1/leads/${lead.id}`).set(bearer(mariana)).send({ status: 'en_seguimiento' });
    expect(upd.status).toBe(200);
    expect((await api().get('/api/v1/leads').set(bearer(laura))).status).toBe(403);
  });
});

describe('Propiedades', () => {
  let newId: string;

  test('el cliente ve solo el catálogo disponible y sin broker; el personal ve todo con broker', async () => {
    const c = await api().get('/api/v1/properties?limit=50').set(bearer(laura));
    expect(c.status).toBe(200);
    expect(c.body.data.every((p: { status: string; visibility: string }) => p.status === 'disponible' && p.visibility === 'publicada')).toBe(true);
    expect(c.body.data[0]).not.toHaveProperty('broker');
    const s = await api().get('/api/v1/properties?limit=50').set(bearer(mariana));
    expect(s.body.pagination.total).toBe(13);
    expect(s.body.data[0].broker).toHaveProperty('name');
  });

  test('el cliente puede ver la ficha de la casa que renta aunque no esté en el catálogo', async () => {
    const res = await api().get(`/api/v1/properties/${await propertyId('ZUG-012')}`).set(bearer(laura));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Casa Las Palmas', rec: 5, banos: 3 });
    expect(res.body.amenities).toContain('Alberca');
    expect((await api().get(`/api/v1/properties/${await propertyId('ZUG-006')}`).set(bearer(laura))).status).toBe(404);
  });

  test('el broker registra una casa: queda asignado, en borrador y con clave nueva', async () => {
    const res = await api().post('/api/v1/properties').set(bearer(mariana)).send({
      name: 'Casa Flamboyán', operation: 'renta', price: 26000, zone: 'Residencial Arbolada', rec: 3, banos: 2.5, amenities: ['Jardín privado', 'Terraza'],
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ code: 'ZUG-013', slug: 'casa-flamboyan', status: 'borrador', visibility: 'borrador', zoneKey: 'residencial-arbolada' });
    expect(res.body.broker.name).toBe('Mariana Solís');
    newId = res.body.id;
  });

  test('publicar exige estado disponible y al menos una foto', async () => {
    const draft = await api().patch(`/api/v1/properties/${newId}/availability`).set(bearer(mariana)).send({ visibility: 'publicada' });
    expect(draft.body.error.code).toBe('CANNOT_PUBLISH_DRAFT');
    const noPhoto = await api().patch(`/api/v1/properties/${newId}/availability`).set(bearer(mariana)).send({ status: 'disponible', visibility: 'publicada' });
    expect(noPhoto.status).toBe(409);
    expect(noPhoto.body.error.code).toBe('PHOTOS_REQUIRED');

    const key = await upload(mariana, 'ZUG-013', 'property_photo', 'image/png', PNG);
    const withPhoto = await api().patch(`/api/v1/properties/${newId}`).set(bearer(mariana)).send({ photos: [{ storageKey: key, label: 'Fachada' }] });
    expect(withPhoto.status).toBe(200);
    expect(withPhoto.body.photos[0].url).toMatch(/\/api\/v1\/files\//);
    const ok = await api().patch(`/api/v1/properties/${newId}/availability`).set(bearer(mariana)).send({ status: 'disponible', visibility: 'publicada' });
    expect(ok.status).toBe(200);
    expect(ok.body.publishedAt).not.toBeNull();
    // La foto se puede descargar con su URL firmada.
    const file = await api().get(new URL(ok.body.photos[0].url).pathname);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toBe('image/png');
  });

  test('una foto que no se subió o de otra casa se rechaza', async () => {
    const res = await api().patch(`/api/v1/properties/${newId}`).set(bearer(mariana)).send({ photos: [{ storageKey: 'properties/ZUG-001/photos/00000000-0000-4000-8000-000000000000.jpg', label: 'x' }] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_FILE');
  });

  test('un broker no modifica casas ajenas; solo administración reasigna (y mueve las citas próximas)', async () => {
    expect((await api().patch(`/api/v1/properties/${newId}`).set(bearer(diego)).send({ price: 1 })).status).toBe(403);
    expect((await api().patch(`/api/v1/properties/${newId}/broker`).set(bearer(mariana)).send({ brokerId: (await login(EMAILS.diego)).user.id })).status).toBe(403);

    const ceiba = await propertyId('ZUG-001');
    const before = await pool.query(`SELECT count(*)::int AS n FROM appointments WHERE property_id = $1 AND status IN ('por-confirmar','confirmada') AND scheduled_at > now()`, [ceiba]);
    const diegoId = (await pool.query(`SELECT id FROM users WHERE email = $1`, [EMAILS.diego])).rows[0].id;
    const res = await api().patch(`/api/v1/properties/${ceiba}/broker`).set(bearer(admin)).send({ brokerId: diegoId });
    expect(res.status).toBe(200);
    expect(res.body.broker.name).toBe('Diego Herrera');
    expect(res.body.appointmentsReassigned).toBe(before.rows[0].n);
    // Se regresa a Mariana para el resto de las pruebas.
    const marianaId = (await pool.query(`SELECT id FROM users WHERE email = $1`, [EMAILS.mariana])).rows[0].id;
    await api().patch(`/api/v1/properties/${ceiba}/broker`).set(bearer(admin)).send({ brokerId: marianaId });
  });

  test('no se da de baja una casa con contrato vigente; una sin contrato sí (baja lógica)', async () => {
    const palmas = await api().delete(`/api/v1/properties/${await propertyId('ZUG-012')}`).set(bearer(mariana));
    expect(palmas.status).toBe(409);
    expect(palmas.body.error.code).toBe('HAS_ACTIVE_CONTRACT');
    const del = await api().delete(`/api/v1/properties/${newId}`).set(bearer(mariana));
    expect(del.status).toBe(200);
    const { rows } = await pool.query('SELECT active FROM properties WHERE id = $1', [newId]);
    expect(rows[0].active).toBe(false);
  });
});

describe('Clientes y contratos', () => {
  let contractId: string;

  test('el broker ve solo sus clientes', async () => {
    const res = await api().get('/api/v1/clients?limit=50').set(bearer(diego));
    expect(res.status).toBe(200);
    const names = res.body.data.map((c: { name: string }) => c.name);
    expect(names).toEqual(expect.arrayContaining(['Jorge Ramírez', 'Andrés Torres']));
    expect(names).not.toContain('Laura Mendez');
  });

  test('registrar un contrato genera los pagarés y marca la casa como rentada', async () => {
    const ceiba = await propertyId('ZUG-001');
    const ana = (await pool.query(`SELECT id FROM clients WHERE email = 'ana@example.com'`)).rows[0].id;
    const res = await api().post('/api/v1/contracts').set(bearer(mariana)).send({
      propertyId: ceiba, clientId: ana, startDate: '2026-11-01', endDate: '2027-10-31', monthlyRent: 28000, paymentDay: 5, deposit: 28000,
    });
    expect(res.status).toBe(201);
    expect(res.body.notes).toMatchObject({ total: 12, paid: 0 });
    contractId = res.body.id;
    const p = await pool.query('SELECT status, visibility FROM properties WHERE id = $1', [ceiba]);
    expect(p.rows[0]).toEqual({ status: 'rentada', visibility: 'pausada' });
    const notes = await pool.query(`SELECT to_char(min(due_date), 'YYYY-MM-DD') AS first, to_char(max(due_date), 'YYYY-MM-DD') AS last FROM promissory_notes WHERE contract_id = $1`, [contractId]);
    expect(notes.rows[0]).toEqual({ first: '2026-11-05', last: '2027-10-05' });
  });

  test('una casa no puede tener dos contratos vigentes', async () => {
    const res = await api().post('/api/v1/contracts').set(bearer(mariana)).send({
      propertyId: await propertyId('ZUG-001'), clientId: (await pool.query(`SELECT id FROM clients WHERE email = 'sofia.m@example.com'`)).rows[0].id,
      startDate: '2026-12-01', endDate: '2027-11-30', monthlyRent: 28000, paymentDay: 5,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ACTIVE_CONTRACT_EXISTS');
  });

  test('finalizar el contrato cancela los pagarés futuros sin borrarlos', async () => {
    const res = await api().post(`/api/v1/contracts/${contractId}/finish`).set(bearer(mariana)).send({ endDate: '2027-01-31', reason: 'Cambio de ciudad' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('finished');
    const { rows } = await pool.query(`SELECT status, count(*)::int AS n FROM promissory_notes WHERE contract_id = $1 GROUP BY status ORDER BY status`, [contractId]);
    expect(rows).toEqual([{ status: 'pending', n: 3 }, { status: 'cancelled', n: 9 }]);
  });
});

describe('Citas y chat', () => {
  let apptId: string;

  test('el cliente solicita una visita del catálogo; la respuesta no trae al broker', async () => {
    const f = future(12, '16:00');
    const res = await api().post('/api/v1/appointments').set(bearer(laura)).send({ propertyId: await propertyId('ZUG-005'), scheduledAt: f.iso, note: 'Quiero ver la alberca.' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('por-confirmar');
    expect(res.body).not.toHaveProperty('broker');
    apptId = res.body.id;
    expect((await notificationsOf(EMAILS.mariana, 'appointment_requested')).some((n) => n.entity_id === apptId)).toBe(true);
  });

  test('solo el personal confirma; el cliente recibe el aviso', async () => {
    expect((await api().post(`/api/v1/appointments/${apptId}/confirm`).set(bearer(laura))).status).toBe(403);
    expect((await api().post(`/api/v1/appointments/${apptId}/confirm`).set(bearer(diego))).status).toBe(403);
    const ok = await api().post(`/api/v1/appointments/${apptId}/confirm`).set(bearer(mariana));
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('confirmada');
    expect(ok.body.confirmedBy).toMatch(/^Confirmada por Mariana/);
    expect((await notificationsOf(EMAILS.laura, 'appointment_confirmed')).some((n) => n.entity_id === apptId)).toBe(true);
  });

  test('reprogramar la regresa a por confirmar; cancelar la cierra', async () => {
    const f = future(14, '17:30');
    const r = await api().post(`/api/v1/appointments/${apptId}/reschedule`).set(bearer(laura)).send({ scheduledAt: f.iso, reason: 'Me queda mejor en la tarde' });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('por-confirmar');
    const c = await api().post(`/api/v1/appointments/${apptId}/cancel`).set(bearer(laura)).send({ reason: 'Ya encontré casa' });
    expect(c.body.status).toBe('cancelada');
    const again = await api().post(`/api/v1/appointments/${apptId}/cancel`).set(bearer(laura)).send({});
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('INVALID_STATUS');
  });

  test('chat de la cita: el personal aparece como «Zugar» para el cliente', async () => {
    const cit = (await pool.query(`SELECT id FROM appointments WHERE code = 'CIT-019'`)).rows[0].id;
    const sent = await api().post(`/api/v1/appointments/${cit}/messages`).set(bearer(laura)).send({ body: '¿Puedo llevar a mi perro?' });
    expect(sent.status).toBe(201);
    expect(sent.body.data[0]).toMatchObject({ sender: 'Zugar', fromStaff: true, mine: false });
    expect(sent.body.data.at(-1)).toMatchObject({ mine: true, body: '¿Puedo llevar a mi perro?' });
    expect((await notificationsOf(EMAILS.mariana, 'appointment_message')).length).toBe(1);
    expect((await api().get(`/api/v1/appointments/${cit}`).set(bearer(diego))).status).toBe(403);
  });
});

describe('Pagarés y pagos', () => {
  let note5: string, paymentId: string;

  test('el cliente consulta sus pagarés con el resumen «Estado de pagos»', async () => {
    const res = await api().get('/api/v1/promissory-notes').set(bearer(laura));
    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({ total: 12, paid: 4, remaining: 8, remainingAmount: 96000, next: { number: 5, dueDate: '2026-11-05' } });
    expect(res.body.data[0]).toMatchObject({ label: 'Pagaré 05', status: 'pending' });
    expect(res.body.data.every((n: { client?: unknown }) => n.client === undefined)).toBe(true);
    note5 = res.body.data[0].id;
    const paid = res.body.data.find((n: { number: number }) => n.number === 4);
    expect(paid.payment).not.toHaveProperty('registeredBy');
    expect(paid.proofDocumentId).toEqual(expect.any(String));
  });

  test('solo el broker responsable registra el pago, y debe cubrir el monto completo', async () => {
    const body = { amount: 12000, paidAt: new Date().toISOString(), receiptFolio: 'REC-ZUG-012-05' };
    expect((await api().post(`/api/v1/promissory-notes/${note5}/payments`).set(bearer(laura)).send(body)).status).toBe(403);
    expect((await api().post(`/api/v1/promissory-notes/${note5}/payments`).set(bearer(diego)).send(body)).status).toBe(403);
    const wrong = await api().post(`/api/v1/promissory-notes/${note5}/payments`).set(bearer(mariana)).send({ ...body, amount: 11000 });
    expect(wrong.body.error.code).toBe('AMOUNT_MISMATCH');
    const ok = await api().post(`/api/v1/promissory-notes/${note5}/payments`).set(bearer(mariana)).send(body);
    expect(ok.status).toBe(201);
    expect(ok.body.status).toBe('paid');
    paymentId = ok.body.payment.id;
    const twice = await api().post(`/api/v1/promissory-notes/${note5}/payments`).set(bearer(mariana)).send(body);
    expect(twice.body.error.code).toBe('ALREADY_PAID');
    expect((await notificationsOf(EMAILS.laura, 'payment_registered')).some((n) => n.entity_id === note5)).toBe(true);
  });

  test('corregir o anular pagos es solo de administración; al anular, el pagaré vuelve a pendiente', async () => {
    const path = `/api/v1/promissory-notes/${note5}/payments/${paymentId}`;
    expect((await api().patch(path).set(bearer(mariana)).send({ receiptFolio: 'X' })).status).toBe(403);
    const fix = await api().patch(path).set(bearer(admin)).send({ receiptFolio: 'REC-ZUG-012-05B' });
    expect(fix.body.payment.receiptFolio).toBe('REC-ZUG-012-05B');
    const v = await api().post(`${path}/void`).set(bearer(admin)).send({ reason: 'Se registró en el pagaré equivocado' });
    expect(v.status).toBe(200);
    expect(v.body.status).toBe('pending');
    const detail = await api().get(`/api/v1/promissory-notes/${note5}`).set(bearer(admin));
    expect(detail.body.voidedPayments).toHaveLength(1);
  });
});

describe('Recibos', () => {
  test('el cliente ve los recibos de su casa; un recibo nuevo le llega como aviso', async () => {
    const list = await api().get('/api/v1/receipts').set(bearer(laura));
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(5);
    expect(list.body.data.find((r: { concept: string; status: string }) => r.concept === 'Recibo de luz' && r.status === 'pending')).toMatchObject({ periodLabel: 'sep-oct' });

    const res = await api().post('/api/v1/receipts').set(bearer(mariana)).send({ propertyId: await propertyId('ZUG-012'), concept: 'Recibo de agua', amount: 405, periodStart: '2026-11-01', periodEnd: '2026-11-30', dueDate: future(20).date });
    expect(res.status).toBe(201);
    expect((await notificationsOf(EMAILS.laura, 'receipt_created')).length).toBe(1);
    expect((await api().post('/api/v1/receipts').set(bearer(laura)).send({ propertyId: await propertyId('ZUG-012'), concept: 'X', amount: 1 })).status).toBe(403);
  });
});

describe('Mantenimiento', () => {
  let reportId: string;

  test('el cliente reporta en su casa con fotos; se avisa al broker y a administración', async () => {
    const key = await upload(laura, 'ZUG-012', 'maintenance_photo', 'image/png', PNG);
    const res = await api().post('/api/v1/maintenance-reports').set(bearer(laura)).send({
      propertyId: await propertyId('ZUG-012'), title: 'Aire acondicionado no enfría', description: 'El minisplit de la recámara principal no enfría.', category: 'Climatización', priority: 'medium', photos: [key],
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'reported', subtitle: 'Climatización - prioridad media' });
    expect(res.body.photos.before).toHaveLength(1);
    reportId = res.body.id;
    expect((await notificationsOf(EMAILS.mariana, 'maintenance_reported')).length).toBe(1);
    expect((await notificationsOf(EMAILS.admin, 'maintenance_reported')).length).toBe(1);
  });

  test('el cliente no reporta en casas ajenas ni cambia estados', async () => {
    const other = await api().post('/api/v1/maintenance-reports').set(bearer(laura)).send({ propertyId: await propertyId('ZUG-001'), title: 'Fuga', description: 'Fuga en la cocina', category: 'Plomería' });
    expect(other.status).toBe(403);
    expect((await api().post(`/api/v1/maintenance-reports/${reportId}/updates`).set(bearer(laura)).send({ status: 'resolved' })).status).toBe(403);
    const client = await api().post('/api/v1/documents/upload-url').set(bearer(laura)).send({ propertyId: await propertyId('ZUG-012'), purpose: 'document', mime: 'application/pdf', size: 100 });
    expect(client.status).toBe(403);
  });

  test('el broker asigna proveedor y cambia el estado; la línea de tiempo y el aviso llegan al cliente', async () => {
    const provider = (await pool.query(`SELECT id FROM providers WHERE specialty = 'Electricidad'`)).rows[0].id;
    const res = await api().post(`/api/v1/maintenance-reports/${reportId}/updates`).set(bearer(mariana)).send({ status: 'in_repair', comment: 'Mañana viene el técnico.', providerId: provider });
    expect(res.status).toBe(200);
    expect(res.body.statusLabel).toBe('En reparación');
    expect(res.body.timeline.map((t: { status: string }) => t.status)).toEqual(['reported', 'in_repair']);
    const forClient = await api().get(`/api/v1/maintenance-reports/${reportId}`).set(bearer(laura));
    expect(forClient.body.timeline[1].author).toBe('Zugar');
    expect((await notificationsOf(EMAILS.laura, 'maintenance_status')).some((n) => n.entity_id === reportId)).toBe(true);
  });
});

describe('Documentos y expediente', () => {
  test('el personal sube un documento visible; el cliente lo ve y lo descarga con URL firmada', async () => {
    const key = await upload(mariana, 'ZUG-012', 'document', 'application/pdf', PDF);
    const res = await api().post('/api/v1/documents').set(bearer(mariana)).send({ propertyId: await propertyId('ZUG-012'), storageKey: key, type: 'annex', name: 'Anexo C · Mascotas', mime: 'application/pdf', visibleToClient: true });
    expect(res.status).toBe(201);
    expect(res.body.size).toBe(PDF.length);

    const list = await api().get('/api/v1/documents?limit=50').set(bearer(laura));
    const names = list.body.data.map((d: { name: string }) => d.name);
    expect(names).toContain('Anexo C · Mascotas');
    expect(names).not.toContain('Identificación del aval');
    const url = await api().get(`/api/v1/documents/${res.body.id}/download-url`).set(bearer(laura));
    expect(url.body.method).toBe('GET');
    const file = await api().get(new URL(url.body.url).pathname);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toBe('application/pdf');
    const hidden = (await pool.query(`SELECT id FROM documents WHERE name = 'Identificación del aval'`)).rows[0].id;
    expect((await api().get(`/api/v1/documents/${hidden}/download-url`).set(bearer(laura))).status).toBe(404);
    expect((await api().get('/api/v1/files/token-falso.firma')).status).toBe(403);
  });

  test('expediente: el cliente ve la vista restringida; el personal, todo', async () => {
    const id = await propertyId('ZUG-012');
    const c = await api().get(`/api/v1/properties/${id}/dossier`).set(bearer(laura));
    expect(c.status).toBe(200);
    expect(c.body.sections.map((s: { title: string }) => s.title)).toEqual(['Contrato de renta', 'Depósito en garantía', 'Ficha de entrega', 'Documentos']);
    expect(c.body.sections[0].subtitle).toBe('Vigente hasta 30 jun 2027');
    expect(c.body).not.toHaveProperty('expenses');
    expect(JSON.stringify(c.body)).not.toMatch(/Mariana|broker/);
    const s = await api().get(`/api/v1/properties/${id}/dossier`).set(bearer(mariana));
    expect(s.body.expenses.total).toBeGreaterThan(0);
    expect(s.body.tenant.name).toBe('Laura Mendez');
    expect((await api().get(`/api/v1/properties/${id}/dossier`).set(bearer(diego))).status).toBe(403);
  });
});

describe('Proveedores, gastos, usuarios, notificaciones y dashboard', () => {
  test('proveedores: consulta para el personal, cliente sin acceso', async () => {
    expect((await api().get('/api/v1/providers').set(bearer(diego))).body.data.length).toBe(3);
    expect((await api().get('/api/v1/providers').set(bearer(laura))).status).toBe(403);
    const created = await api().post('/api/v1/providers').set(bearer(diego)).send({ name: 'Cerrajería Express', specialty: 'Cerrajería', phone: '+52 998 555 0204' });
    expect(created.status).toBe(201);
  });

  test('gastos con totales, solo de las casas propias', async () => {
    const res = await api().get(`/api/v1/expenses?propertyId=${await propertyId('ZUG-012')}`).set(bearer(mariana));
    expect(res.status).toBe(200);
    expect(res.body.totals).toEqual({ total: 2450, paid: 1250, pending: 1200 });
    expect((await api().get(`/api/v1/expenses?propertyId=${await propertyId('ZUG-012')}`).set(bearer(diego))).status).toBe(200);
    expect((await api().get(`/api/v1/expenses?propertyId=${await propertyId('ZUG-012')}`).set(bearer(diego))).body.data).toHaveLength(0);
  });

  test('administración da de alta personal y configura permisos; nadie más', async () => {
    expect((await api().get('/api/v1/users').set(bearer(mariana))).status).toBe(403);
    const res = await api().post('/api/v1/users').set(bearer(admin)).send({ name: 'Rocío Pech', email: 'rocio@zugar.example', roles: ['broker'], password: 'Rocio2026x' });
    expect(res.status).toBe(201);
    expect(res.body.roles).toEqual(['broker']);
    const self = await api().patch(`/api/v1/users/${(await login(EMAILS.admin)).user.id}`).set(bearer(admin)).send({ active: false });
    expect(self.body.error.code).toBe('SELF_LOCKOUT');
    const roles = await api().get('/api/v1/users/roles').set(bearer(admin));
    expect(roles.body.roles.find((r: { code: string }) => r.code === 'admin').permissions).toContain('users.manage');
  });

  test('notificaciones: contador, marcar leída y todas', async () => {
    const list = await api().get('/api/v1/notifications').set(bearer(laura));
    expect(list.body.unreadCount).toBeGreaterThan(0);
    await api().patch(`/api/v1/notifications/${list.body.data[0].id}/read`).set(bearer(laura));
    const after = await api().get('/api/v1/notifications').set(bearer(laura));
    expect(after.body.unreadCount).toBe(list.body.unreadCount - (list.body.data[0].read ? 0 : 1));
    await api().post('/api/v1/notifications/read-all').set(bearer(laura));
    expect((await api().get('/api/v1/notifications').set(bearer(laura))).body.unreadCount).toBe(0);
    expect((await api().post('/api/v1/devices').set(bearer(laura)).send({ fcmToken: 'token-de-prueba-del-dispositivo-123', platform: 'android' })).status).toBe(204);
  });

  test('dashboard por perfil', async () => {
    const c = await api().get('/api/v1/dashboard').set(bearer(laura));
    expect(c.body).toMatchObject({ profile: 'client', property: { name: 'Casa Las Palmas' }, nextPayment: { number: 5, amount: 12000 } });
    expect(c.body.openReports.count).toBe(2);
    const s = await api().get('/api/v1/dashboard').set(bearer(mariana));
    expect(s.body.profile).toBe('staff');
    expect(s.body.counts).toHaveProperty('appointmentsToConfirm');
    // La app navega a la casa desde las listas cortas.
    for (const r of [...s.body.overdueNotes, ...s.body.newReports]) expect(r.propertyId).toEqual(expect.any(String));
  });
});

describe('Tareas diarias', () => {
  test('marcan vencidos, recuerdan lo próximo y no repiten avisos el mismo día', async () => {
    const day = '2026-11-03';
    const first = await runDailyJobs(day);
    expect(first.noteReminders).toBeGreaterThan(0); // pagaré 05 de Laura (5 nov)
    expect(first.overdueReceipts + first.overdueNotes).toBeGreaterThanOrEqual(0);
    const again = await runDailyJobs(day);
    expect(again.noteReminders).toBe(0);
    expect((await notificationsOf(EMAILS.laura, 'promissory_note_due')).length).toBeGreaterThan(0);

    const later = await runDailyJobs('2026-11-20');
    expect(later.overdueNotes).toBeGreaterThan(0);
    const { rows } = await pool.query(
      `SELECT n.status FROM promissory_notes n JOIN contracts ct ON ct.id = n.contract_id WHERE ct.property_id = $1 AND n.number = 5`,
      [await propertyId('ZUG-012')],
    );
    expect(rows[0].status).toBe('overdue');
    expect((await notificationsOf(EMAILS.admin, 'promissory_note_overdue')).length).toBeGreaterThan(0);
  });
});
