import { pool } from '../config/database.js';
import { runDailyJobs } from '../jobs/daily.job.js';
import { api, bearer, closeDatabase, EMAILS, login, propertyId, resetDatabase } from './helpers.js';

/* Pruebas de los módulos de la Fase 2, en orden (comparten estado). */

let admin: string, mariana: string, diego: string, laura: string;
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4d50000000049454e44ae426082', 'hex');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

const future = (days: number, time = '10:00') => {
  const d = new Date(Date.now() + days * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Cancun' });
  return { date: d, iso: `${d}T${time}:00-05:00` };
};
const userIdOf = async (email: string) => (await pool.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [email])).rows[0].id;
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

  test('una solicitud de visita llega sin broker y avisa a todos; administración también puede asignarla con su cita', async () => {
    const f = future(10);
    const res = await api().post('/api/v1/public/leads').send({ consent: true,
      reason: 'visita', name: 'Pedro Solano', email: 'pedro.solano@correo.com', phone: '998 123 4567', propertySlug: 'casa-ceiba',
      preferredDate: f.date, preferredTime: '11:30', message: 'Me interesa el jardín.', payload: { personas: '3', mascotas: 'no' },
    });
    expect(res.status).toBe(201);
    expect(res.body.folio).toMatch(/^Z-\d{5}$/);
    expect(res.body.appointmentCode).toMatch(/^CIT-\d{3}$/);
    const { rows } = await pool.query(`SELECT status FROM appointments WHERE code = $1`, [res.body.appointmentCode]);
    expect(rows[0].status).toBe('por-confirmar');
    expect((await notificationsOf(EMAILS.admin, 'appointment_requested')).length).toBeGreaterThan(0);
    expect((await notificationsOf(EMAILS.mariana, 'appointment_requested')).length).toBeGreaterThan(0);
    // Sin asignar: todos los brokers la ven; administración puede asignarla sin cambiar los datos de la persona
    const { rows: [lead] } = await pool.query(`SELECT id, broker_id FROM leads WHERE folio = $1`, [res.body.folio]);
    expect(lead.broker_id).toBeNull();
    expect((await api().get(`/api/v1/leads/${lead.id}`).set(bearer(mariana))).status).toBe(200);
    const sinAsignar = await api().get('/api/v1/leads?unassigned=true').set(bearer(admin));
    expect(sinAsignar.body.data.map((l: { id: string }) => l.id)).toContain(lead.id);
    const marianaId = await userIdOf(EMAILS.mariana);
    expect((await api().patch(`/api/v1/leads/${lead.id}/broker`).set(bearer(diego)).send({ brokerId: marianaId })).status).toBe(403);
    const asg = await api().patch(`/api/v1/leads/${lead.id}/broker`).set(bearer(admin)).send({ brokerId: marianaId });
    expect(asg.status).toBe(200);
    expect(asg.body).toMatchObject({ name: 'Pedro Solano', email: 'pedro.solano@correo.com', broker: { id: marianaId, name: 'Mariana Solís' } });
    expect((await notificationsOf(EMAILS.mariana, 'lead_assigned')).length).toBe(1);
    const { rows: [conBroker] } = await pool.query(`SELECT broker_id FROM appointments WHERE code = $1`, [res.body.appointmentCode]);
    expect(conBroker.broker_id).toBe(marianaId);
    // La visita dura 15 minutos y esa hora queda ocupada en el calendario del sitio (sin datos de la persona)
    const { rows: [cita] } = await pool.query(`SELECT duration_min FROM appointments WHERE code = $1`, [res.body.appointmentCode]);
    expect(cita.duration_min).toBe(15);
    const busy = await api().get(`/api/v1/public/properties/casa-ceiba/busy?fecha=${f.date}`);
    expect(busy.status).toBe(200);
    expect(busy.body.busy).toContain('11:30');
    expect(busy.body.busy).not.toContain('11:45');
    expect(JSON.stringify(busy.body)).not.toMatch(/Pedro|correo/);
  });

  test('las visitas van en bloques de 15 minutos', async () => {
    const odd = await api().post('/api/v1/public/leads').send({ consent: true, reason: 'visita', name: 'Pedro Solano', email: 'p@correo.com', propertySlug: 'casa-ceiba', preferredDate: future(11).date, preferredTime: '10:10' });
    expect(odd.status).toBe(400);
    expect(odd.body.error.details).toHaveProperty('preferredTime');
  });

  test('rechaza fechas pasadas y motivos inválidos', async () => {
    const past = await api().post('/api/v1/public/leads').send({ consent: true, reason: 'visita', name: 'Pedro Solano', email: 'p@correo.com', propertySlug: 'casa-ceiba', preferredDate: '2020-01-01', preferredTime: '10:00' });
    expect(past.status).toBe(400);
    expect(past.body.error.details).toHaveProperty('preferredDate');
    const bad = await api().post('/api/v1/public/leads').send({ consent: true, reason: 'regalar', name: 'X Y', email: 'p@correo.com' });
    expect(bad.status).toBe(400);
  });

  test('en su lista el broker ve las suyas; al atender una libre se queda con ella', async () => {
    const all = await api().get('/api/v1/leads').set(bearer(admin));
    const lead = all.body.data.find((l: { reason: string }) => l.reason === 'publicar');
    const list = await api().get('/api/v1/leads').set(bearer(mariana));
    expect(list.status).toBe(200);
    expect(list.body.data.every((l: { broker: { name: string } | null }) => l.broker?.name === 'Mariana Solís')).toBe(true);
    const upd = await api().patch(`/api/v1/leads/${lead.id}`).set(bearer(mariana)).send({ status: 'en_seguimiento' });
    expect(upd.status).toBe(200);
    expect((await api().get('/api/v1/leads').set(bearer(laura))).status).toBe(403);
  });
});

describe('Solicitudes: el cliente pide en la app; el asesor contesta y propone casas', () => {
  let leadId: string;

  test('«Solicitar visita» del catálogo de la app: el formulario de la casa (con mascotas) y su cita', async () => {
    const f = future(16, '10:15');
    const res = await api().post('/api/v1/requests').set(bearer(laura)).send({
      reason: 'rentar', propertyCode: 'ZUG-005', preferredDate: f.date, preferredTime: '10:15',
      payload: { presupuesto_max: 30000, personas: '2', mascotas: 'si', mascotas_detalle: '1 gato', nacionalidad: 'Mexicana', ocupacion: 'Diseño' },
    });
    expect(res.status).toBe(201);
    const { rows: [lead] } = await pool.query(`SELECT l.reason, l.payload, a.status, a.awaiting FROM leads l JOIN appointments a ON a.lead_id = l.id WHERE l.id = $1`, [res.body.id]);
    expect(lead).toMatchObject({ reason: 'visita', status: 'por-confirmar', awaiting: 'staff', payload: expect.objectContaining({ mascotas: 'si', mascotas_detalle: '1 gato', origen: 'app' }) });
    await pool.query(`UPDATE appointments SET status = 'cancelada' WHERE lead_id = $1`, [res.body.id]); // no estorba a las demás pruebas
  });

  test('«Solicitar visita» acepta claves con zona (ZUG-HUA-024), no solo ZUG-007', async () => {
    const f = future(17, '11:00');
    const res = await api().post('/api/v1/requests').set(bearer(laura)).send({
      reason: 'rentar', propertyCode: 'ZUG-HUA-024', preferredDate: f.date, preferredTime: '11:00',
      payload: { presupuesto_max: 20000, personas: '2', mascotas: 'no', nacionalidad: 'Mexicana', ocupacion: 'Diseño' },
    });
    await pool.query(`UPDATE appointments SET status = 'cancelada' WHERE lead_id = $1`, [res.body.id]);
    expect(res.status).toBe(201);
  });

  test('el cliente crea «Busco casa» desde la app y la ve en «Mis solicitudes»', async () => {
    const res = await api().post('/api/v1/requests').set(bearer(laura)).send({ reason: 'rentar', message: 'Busco algo cerca de la playa', payload: { presupuesto: '$15,000', recamaras: '3', zona: 'Puerto Morelos' } });
    expect(res.status).toBe(201);
    expect(res.body.folio).toEqual(expect.any(String));
    expect(res.body).not.toHaveProperty('email');
    leadId = res.body.id;
    const mine = await api().get('/api/v1/requests').set(bearer(laura));
    expect(mine.body.data[0]).toMatchObject({ id: leadId, status: 'nuevo', statusLabel: 'Recibida', proposals: [] });
    expect((await api().get('/api/v1/requests').set(bearer(mariana))).status).toBe(403);
    expect((await api().get('/api/v1/leads').set(bearer(laura))).status).toBe(403);
  });

  test('el asesor propone casas y contesta; al cliente le llega el aviso y lo ve en la app', async () => {
    expect((await api().patch(`/api/v1/leads/${leadId}/broker`).set(bearer(admin)).send({ brokerId: await userIdOf(EMAILS.mariana) })).status).toBe(200);
    const casa = await propertyId('ZUG-001');
    const p = await api().post(`/api/v1/leads/${leadId}/proposals`).set(bearer(mariana)).send({ propertyId: casa, note: 'Tiene jardín' });
    expect(p.status).toBe(201);
    expect(p.body.status).toBe('en_seguimiento');
    expect(p.body.proposals[0]).toMatchObject({ note: 'Tiene jardín', property: { code: 'ZUG-001' } });
    expect((await api().post(`/api/v1/leads/${leadId}/proposals`).set(bearer(mariana)).send({ propertyId: casa })).body.error.code).toBe('ALREADY_PROPOSED');
    const r = await api().patch(`/api/v1/leads/${leadId}`).set(bearer(mariana)).send({ response: 'Te propongo Casa Ceiba; si no te convence, te conseguimos otra.' });
    expect(r.body.response).toMatch(/Casa Ceiba/);
    expect(r.body.respondedBy).toBe('Mariana Solís');
    expect((await notificationsOf(EMAILS.laura, 'lead_update')).length).toBe(2);

    const seen = await api().get(`/api/v1/requests/${leadId}`).set(bearer(laura));
    expect(seen.body.proposals[0].property.name).toBe('Casa Ceiba');
    expect(seen.body.response).toMatch(/te conseguimos otra/);

    // Mensajes: el asesor escribe, el cliente contesta; cada quien recibe su aviso
    const m1 = await api().post(`/api/v1/leads/${leadId}/messages`).set(bearer(mariana)).send({ body: '¿Qué días puedes visitar?' });
    expect(m1.status).toBe(201);
    const m2 = await api().post(`/api/v1/requests/${leadId}/messages`).set(bearer(laura)).send({ body: 'El sábado en la mañana.' });
    expect(m2.body.data.map((m: { sender: string; mine: boolean }) => [m.sender, m.mine])).toEqual([['Zugar', false], ['Laura Mendez', true]]);
    expect((await notificationsOf(EMAILS.mariana, 'lead_message')).length).toBe(1);
    expect((await api().get(`/api/v1/leads/${leadId}/messages`).set(bearer(mariana))).body.data[0].sender).toBe('Mariana Solís');
    expect((await api().post(`/api/v1/requests/${leadId}/messages`).set(bearer(laura)).send({ body: '' })).status).toBe(400);

    const del = await api().delete(`/api/v1/leads/${leadId}/proposals/${p.body.proposals[0].id}`).set(bearer(mariana));
    expect(del.body.proposals).toHaveLength(0);
    const closed = await api().patch(`/api/v1/leads/${leadId}`).set(bearer(admin)).send({ status: 'cerrado' });
    expect(closed.body.statusLabel).toBe('Cerrada');
  });

  test('tiempo real: cada escritura sube el contador de /events/seq; /events pide sesión', async () => {
    expect((await api().get('/api/v1/events')).status).toBe(401);
    expect((await api().get('/api/v1/events/seq')).status).toBe(401);
    const before = (await api().get('/api/v1/events/seq').set(bearer(mariana))).body.seq as number;
    await api().post(`/api/v1/requests`).set(bearer(laura)).send({ reason: 'otro', message: 'Prueba de tiempo real' });
    const after = (await api().get('/api/v1/events/seq').set(bearer(mariana))).body.seq as number;
    expect(after).toBeGreaterThan(before);
  });

  test('el personal registra, corrige, agenda la cita desde la solicitud y administración la elimina', async () => {
    const c = await api().post('/api/v1/leads').set(bearer(mariana)).send({ reason: 'rentar', name: 'Ana Prueb', email: 'ana.prueba@correo.com', phone: '998 000 1111', message: 'Llamó por teléfono' });
    expect(c.status).toBe(201);
    expect(c.body).toMatchObject({ status: 'nuevo', payload: { origen: 'panel' }, appointmentCount: 0, appointments: [] });
    const id = c.body.id;
    const e = await api().patch(`/api/v1/leads/${id}`).set(bearer(mariana)).send({ name: 'Ana Prueba', phone: '998 000 2222' });
    expect(e.body).toMatchObject({ name: 'Ana Prueba', phone: '998 000 2222', message: 'Llamó por teléfono', others: [] });
    // Una segunda solicitud de la misma persona aparece en «otras solicitudes»
    const second = await api().post('/api/v1/leads').set(bearer(mariana)).send({ reason: 'comprar', name: 'Ana Prueba', email: 'ANA.prueba@correo.com', payload: { recamaras: '2' } });
    expect(second.body.others).toEqual([expect.objectContaining({ id, folio: c.body.folio, reason: 'rentar', message: 'Llamó por teléfono' })]);
    expect((await api().get(`/api/v1/leads/${id}`).set(bearer(mariana))).body.others[0]).toMatchObject({ id: second.body.id, payload: { recamaras: '2', origen: 'panel' } });

    const casa = await propertyId('ZUG-001');
    const when = future(12, '16:00').iso;
    // Diego no tiene asignada Casa Ceiba
    expect((await api().post(`/api/v1/leads/${id}/appointment`).set(bearer(diego)).send({ propertyId: casa, scheduledAt: when })).status).toBe(403);
    const s = await api().post(`/api/v1/leads/${id}/appointment`).set(bearer(mariana)).send({ propertyId: casa, scheduledAt: when });
    expect(s.status).toBe(201);
    expect(s.body.appointment.code).toMatch(/^CIT-\d{3}$/);
    expect(s.body.lead).toMatchObject({ status: 'en_seguimiento', appointmentCount: 1, clientId: expect.any(String) });
    expect(s.body.lead.appointments[0]).toMatchObject({ code: s.body.appointment.code, status: 'por-confirmar', property: { code: 'ZUG-001' } });
    // Cambiar la fecha desde la solicitud reprograma la misma cita (antes se creaba otra: citas duplicadas)
    const later = future(13, '11:00').iso;
    const moved = await api().post(`/api/v1/leads/${id}/appointment`).set(bearer(mariana)).send({ propertyId: casa, scheduledAt: later });
    expect(moved.status).toBe(200);
    expect(moved.body).toMatchObject({ rescheduled: true, appointment: { code: s.body.appointment.code }, lead: { appointmentCount: 1 } });
    expect(new Date(moved.body.lead.appointments[0].scheduledAt).toISOString()).toBe(new Date(later).toISOString());

    expect((await api().delete(`/api/v1/leads/${id}`).set(bearer(mariana))).status).toBe(403);
    expect((await api().delete(`/api/v1/leads/${id}`).set(bearer(admin))).status).toBe(204);
    expect((await api().get(`/api/v1/leads/${id}`).set(bearer(admin))).status).toBe(404);
    const appt = await pool.query('SELECT id, lead_id FROM appointments WHERE id = $1', [s.body.appointment.id]);
    expect(appt.rows[0].lead_id).toBeNull();
    // Se cancela para no alterar los conteos de las pruebas siguientes
    expect((await api().post(`/api/v1/appointments/${s.body.appointment.id}/cancel`).set(bearer(admin)).send({})).status).toBe(200);
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

  test('el broker registra una casa: queda asignado, disponible y pausada (sin borrador) y con clave nueva', async () => {
    const res = await api().post('/api/v1/properties').set(bearer(mariana)).send({
      name: 'Casa Flamboyán', operation: 'renta', price: 26000, zone: 'Residencial Arbolada', rec: 3, banos: 2.5, amenities: ['Jardín privado', 'Terraza'],
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ code: 'ZUG-013', slug: 'casa-flamboyan', status: 'disponible', visibility: 'pausada', zoneKey: 'residencial-arbolada' });
    expect(res.body.broker.name).toBe('Mariana Solís');
    newId = res.body.id;
  });

  test('publicar exige al menos una foto', async () => {
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

  test('inquilino solo con contrato: no se marca a mano (la casa quedaría publicada y sin pagarés)', async () => {
    const ana = (await pool.query(`SELECT id FROM clients WHERE email = 'ana@example.com'`)).rows[0].id;
    const r = await api().patch(`/api/v1/clients/${ana}`).set(bearer(admin)).send({ kind: 'inquilino' });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('NEEDS_CONTRACT');
    expect((await api().patch(`/api/v1/clients/${ana}`).set(bearer(admin)).send({ followStatus: 'Contrato vigente' })).body.error.code).toBe('NEEDS_CONTRACT');
    expect((await api().post('/api/v1/clients').set(bearer(admin)).send({ name: 'Nadia Prueba', kind: 'inquilino' })).status).toBe(409);
  });

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
    const res = await api().post('/api/v1/contracts').set(bearer(admin)).send({
      propertyId: ceiba, clientId: ana, startDate: '2026-12-01', endDate: '2027-11-30', monthlyRent: 28000, paymentDay: 5, deposit: 28000,
    });
    expect(res.status).toBe(201);
    expect(res.body.notes).toMatchObject({ total: 12, paid: 0 });
    contractId = res.body.id;
    const p = await pool.query('SELECT status, visibility FROM properties WHERE id = $1', [ceiba]);
    expect(p.rows[0]).toEqual({ status: 'rentada', visibility: 'pausada' });
    // Nuevo inquilino: le llega el aviso al broker de la casa (quien lo registró no se avisa a sí mismo)
    expect((await notificationsOf(EMAILS.mariana, 'tenant_created')).length).toBe(1);
    expect(await notificationsOf(EMAILS.admin, 'tenant_created')).toHaveLength(0);
    // Sección «Rentas»: el broker consulta las de sus casas (sin poder crearlas) con adeudo, próximo pago y reportes
    const rentas = await api().get('/api/v1/contracts?status=active').set(bearer(mariana));
    expect(rentas.status).toBe(200);
    expect(rentas.body.data.find((c: { id: string }) => c.id === contractId)).toMatchObject({
      monthlyRent: 28000, client: { name: expect.any(String) }, broker: { name: 'Mariana Solís' },
      notes: { total: 12, paid: 0, overdue: 0, owed: 0, nextDue: expect.any(String) }, openReports: expect.any(Number), utilities: expect.any(Object),
    });
    const notes = await pool.query(`SELECT to_char(min(due_date), 'YYYY-MM-DD') AS first, to_char(max(due_date), 'YYYY-MM-DD') AS last FROM promissory_notes WHERE contract_id = $1`, [contractId]);
    expect(notes.rows[0]).toEqual({ first: '2026-12-05', last: '2027-11-05' });
  });

  test('hacer inquilino es solo de administración: el broker no registra contratos', async () => {
    const res = await api().post('/api/v1/contracts').set(bearer(mariana)).send({
      propertyId: await propertyId('ZUG-002'), clientId: (await pool.query(`SELECT id FROM clients WHERE email = 'sofia.m@example.com'`)).rows[0].id,
      startDate: '2026-12-01', endDate: '2027-11-30', monthlyRent: 20000, paymentDay: 10,
    });
    expect(res.status).toBe(403);
  });

  test('PDF del contrato firmado; los pagarés ya no se separan de un PDF (se generan solos)', async () => {
    const { PDFDocument } = await import('pdf-lib');
    const doc = await PDFDocument.create();
    doc.addPage([300, 400]);
    const contractKey = await upload(admin, 'ZUG-001', 'document', 'application/pdf', Buffer.from(await doc.save()));
    const att = await api().post(`/api/v1/contracts/${contractId}/document`).set(bearer(admin)).send({ storageKey: contractKey });
    expect(att.status).toBe(201);
    expect(att.body.contract.documentId).toBe(att.body.documentId);
    expect((await api().post(`/api/v1/contracts/${contractId}/promissory-notes-pdf`).set(bearer(admin)).send({ storageKey: contractKey })).status).toBe(404);
  });

  test('una casa no puede tener dos contratos vigentes', async () => {
    const res = await api().post('/api/v1/contracts').set(bearer(admin)).send({
      propertyId: await propertyId('ZUG-001'), clientId: (await pool.query(`SELECT id FROM clients WHERE email = 'sofia.m@example.com'`)).rows[0].id,
      startDate: '2026-12-01', endDate: '2027-11-30', monthlyRent: 28000, paymentDay: 5,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ACTIVE_CONTRACT_EXISTS');
  });

  test('con contrato vigente la casa no se vuelve a publicar ni a poner disponible (hasta finalizarlo)', async () => {
    const ceiba = await propertyId('ZUG-001');
    for (const body of [{ visibility: 'publicada' }, { status: 'disponible' }, { status: 'disponible', visibility: 'publicada' }]) {
      const r = await api().patch(`/api/v1/properties/${ceiba}/availability`).set(bearer(admin)).send(body);
      expect(r.status).toBe(409);
      expect(r.body.error.code).toBe('ACTIVE_CONTRACT');
    }
    expect((await pool.query('SELECT status, visibility FROM properties WHERE id = $1', [ceiba])).rows[0]).toEqual({ status: 'rentada', visibility: 'pausada' });
  });

  test('finalizar el contrato cancela los pagarés futuros sin borrarlos', async () => {
    const res = await api().post(`/api/v1/contracts/${contractId}/finish`).set(bearer(admin)).send({ endDate: '2027-01-31', reason: 'Cambio de ciudad' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('finished');
    const { rows } = await pool.query(`SELECT status, count(*)::int AS n FROM promissory_notes WHERE contract_id = $1 GROUP BY status ORDER BY status`, [contractId]);
    expect(rows).toEqual([{ status: 'pending', n: 2 }, { status: 'cancelled', n: 10 }]);
  });

  test('terminar un contrato el mismo día que empieza lo deja cancelado (no da error)', async () => {
    const casa = await propertyId('ZUG-001');
    const ana = (await pool.query(`SELECT id FROM clients WHERE email = 'ana@example.com'`)).rows[0].id;
    const start = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Cancun' });
    const c = await api().post('/api/v1/contracts').set(bearer(admin)).send({ propertyId: casa, clientId: ana, startDate: start, endDate: '2099-01-01', monthlyRent: 1000, paymentDay: 28 });
    expect(c.status).toBe(201);
    const res = await api().post(`/api/v1/contracts/${c.body.id}/finish`).set(bearer(admin)).send({ endDate: start, reason: 'Registro de prueba' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM promissory_notes WHERE contract_id = $1 AND status <> 'cancelled'`, [c.body.id]);
    expect(rows[0].n).toBe(0);
    expect((await pool.query('SELECT status FROM properties WHERE id = $1', [casa])).rows[0].status).toBe('disponible');
  });
});

describe('Citas y chat', () => {
  let apptId: string;

  test('el cliente solicita una visita del catálogo y ve el contacto de su asesor', async () => {
    const f = future(12, '16:00');
    const res = await api().post('/api/v1/appointments').set(bearer(laura)).send({ propertyId: await propertyId('ZUG-005'), scheduledAt: f.iso, note: 'Quiero ver la alberca.' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('por-confirmar');
    expect(res.body.broker).toMatchObject({ name: 'Mariana Solís', email: EMAILS.mariana });
    expect(res.body.property.address).toBe(''); // la dirección exacta, hasta confirmar
    apptId = res.body.id;
    expect((await notificationsOf(EMAILS.mariana, 'appointment_requested')).some((n) => n.entity_id === apptId)).toBe(true);
  });

  test('la pidió el cliente: la confirma el personal (no ella misma); el cliente recibe el aviso', async () => {
    const mine = await api().post(`/api/v1/appointments/${apptId}/confirm`).set(bearer(laura));
    expect(mine.status).toBe(409);
    expect(mine.body.error.code).toBe('WAITING_STAFF');
    expect((await api().post(`/api/v1/appointments/${apptId}/confirm`).set(bearer(diego))).status).toBe(403);
    const ok = await api().post(`/api/v1/appointments/${apptId}/confirm`).set(bearer(mariana));
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('confirmada');
    expect(ok.body.confirmedBy).toMatch(/^Confirmada por Mariana/);
    expect((await notificationsOf(EMAILS.laura, 'appointment_confirmed')).some((n) => n.entity_id === apptId)).toBe(true);
  });

  test('acuerdo de fecha: si el personal la cambia, el cliente la acepta (y el personal no la confirma por él)', async () => {
    const f = future(13, '12:15');
    const r = await api().post(`/api/v1/appointments/${apptId}/reschedule`).set(bearer(mariana)).send({ scheduledAt: f.iso });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: 'por-confirmar', awaiting: 'client', canAccept: false });
    const aviso = (await notificationsOf(EMAILS.laura, 'appointment_rescheduled')).find((n) => n.entity_id === apptId);
    expect(aviso.title).toBe('Nueva fecha para tu visita');
    expect(aviso.message).toMatch(/Acéptala en la app/);
    const staff = await api().post(`/api/v1/appointments/${apptId}/confirm`).set(bearer(mariana));
    expect(staff.body.error.code).toBe('WAITING_CLIENT');
    expect((await api().get(`/api/v1/appointments/${apptId}`).set(bearer(laura))).body.canAccept).toBe(true);
    const ok = await api().post(`/api/v1/appointments/${apptId}/confirm`).set(bearer(laura));
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('confirmada');
    expect((await notificationsOf(EMAILS.mariana, 'appointment_confirmed')).some((n) => n.entity_id === apptId && /aceptó/.test(n.message))).toBe(true);
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

  test('chat de la cita: el cliente ve el nombre de su asesor (contacto mutuo)', async () => {
    const cit = (await pool.query(`SELECT id FROM appointments WHERE code = 'CIT-019'`)).rows[0].id;
    const sent = await api().post(`/api/v1/appointments/${cit}/messages`).set(bearer(laura)).send({ body: '¿Puedo llevar a mi perro?' });
    expect(sent.status).toBe(201);
    expect(sent.body.data[0]).toMatchObject({ sender: 'Mariana Solís', fromStaff: true, mine: false });
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
    const body = { amount: 12000, paidAt: new Date().toISOString() }; // sin folio: lo genera el servidor
    expect((await api().post(`/api/v1/promissory-notes/${note5}/payments`).set(bearer(laura)).send(body)).status).toBe(403);
    expect((await api().post(`/api/v1/promissory-notes/${note5}/payments`).set(bearer(diego)).send(body)).status).toBe(403);
    const wrong = await api().post(`/api/v1/promissory-notes/${note5}/payments`).set(bearer(mariana)).send({ ...body, amount: 11000 });
    expect(wrong.body.error.code).toBe('AMOUNT_MISMATCH');
    const ok = await api().post(`/api/v1/promissory-notes/${note5}/payments`).set(bearer(mariana)).send(body);
    expect(ok.status).toBe(201);
    expect(ok.body.status).toBe('paid');
    expect(ok.body.payment.receiptFolio).toBe('REC-ZUG-012-05');
    paymentId = ok.body.payment.id;
    const twice = await api().post(`/api/v1/promissory-notes/${note5}/payments`).set(bearer(mariana)).send(body);
    expect(twice.body.error.code).toBe('ALREADY_PAID');
    expect((await notificationsOf(EMAILS.laura, 'payment_registered')).some((n) => n.entity_id === note5)).toBe(true);
  });

  test('corregir o anular pagos es solo de administración; al anular, el pagaré vuelve a pendiente', async () => {
    const path = `/api/v1/promissory-notes/${note5}/payments/${paymentId}`;
    expect((await api().patch(path).set(bearer(mariana)).send({ receiptFolio: 'X' })).status).toBe(403);
    const fix = await api().patch(path).set(bearer(admin)).send({ notes: 'Pagó en la oficina' });
    expect(fix.body.payment.notes).toBe('Pagó en la oficina');
    const v = await api().post(`${path}/void`).set(bearer(admin)).send({ reason: 'Se registró en el pagaré equivocado' });
    expect(v.status).toBe(200);
    // Sin pago vuelve a estar por cobrar: pendiente, o vencido si su fecha ya pasó
    expect(['pending', 'overdue']).toContain(v.body.status);
    const detail = await api().get(`/api/v1/promissory-notes/${note5}`).set(bearer(admin));
    expect(detail.body.voidedPayments).toHaveLength(1);
    // Volver a registrar: el folio no se repite
    const again = await api().post(`/api/v1/promissory-notes/${note5}/payments`).set(bearer(mariana)).send({ amount: 12000, paidAt: new Date().toISOString() });
    expect(again.body.payment.receiptFolio).toBe('REC-ZUG-012-05-B');
    // Se deja pendiente otra vez para las pruebas de dashboard y tareas diarias
    await api().post(`/api/v1/promissory-notes/${note5}/payments/${again.body.payment.id}/void`).set(bearer(admin)).send({ reason: 'Prueba de folio automático' });
  });

  test('administración agrega un pagaré al contrato y cancela uno que no se cobrará (el broker no); uno pagado no se cancela', async () => {
    const notes = (await api().get('/api/v1/promissory-notes').set(bearer(laura))).body;
    const contractId = notes.data[0].contractId;
    expect((await api().post('/api/v1/promissory-notes').set(bearer(mariana)).send({ contractId, amount: 2500, dueDate: '2027-07-05' })).status).toBe(403);
    const extra = await api().post('/api/v1/promissory-notes').set(bearer(admin)).send({ contractId, amount: 2500, dueDate: '2027-07-05' });
    expect(extra.status).toBe(201);
    expect(extra.body).toMatchObject({ number: 13, amount: 2500, status: 'pending' });
    expect((await api().post('/api/v1/promissory-notes').set(bearer(laura)).send({ contractId, amount: 1, dueDate: '2027-07-05' })).status).toBe(403);
    expect((await api().post(`/api/v1/promissory-notes/${extra.body.id}/cancel`).set(bearer(admin)).send({ reason: 'x' })).status).toBe(400);
    const cancelled = await api().post(`/api/v1/promissory-notes/${extra.body.id}/cancel`).set(bearer(admin)).send({ reason: 'Se acordó no cobrar ese cargo' });
    expect(cancelled.body.status).toBe('cancelled');
    const paid = notes.data.find((n: { status: string }) => n.status === 'paid');
    expect((await api().post(`/api/v1/promissory-notes/${paid.id}/cancel`).set(bearer(admin)).send({ reason: 'Prueba de pagado' })).body.error.code).toBe('ALREADY_PAID');
  });

  test('PDF del pagaré: el broker lo sube y el cliente lo ve; uno de otra casa se rechaza', async () => {
    const notes = await api().get('/api/v1/promissory-notes').set(bearer(laura));
    const note6 = notes.body.data.find((n: { number: number }) => n.number === 6);
    expect(note6.documentId).toBeNull();
    const key = await upload(mariana, 'ZUG-012', 'document', 'application/pdf', PDF);
    const doc = { propertyId: await propertyId('ZUG-012'), storageKey: key, type: 'promissory_note', name: 'Pagaré 06 firmado', mime: 'application/pdf', visibleToClient: true };
    expect((await api().post('/api/v1/documents').set(bearer(mariana)).send(doc)).body.error.code).toBe('VALIDATION_ERROR');
    const res = await api().post('/api/v1/documents').set(bearer(mariana)).send({ ...doc, promissoryNoteId: note6.id });
    expect(res.status).toBe(201);
    const after = (await api().get(`/api/v1/promissory-notes/${note6.id}`).set(bearer(laura))).body;
    expect(after.documentId).toBe(res.body.id);
    expect(after.proofDocumentId).toBeNull(); // el PDF del pagaré no cuenta como comprobante de pago
    expect((await api().get(`/api/v1/documents/${res.body.id}/download-url`).set(bearer(laura))).status).toBe(200);
    // No aparece suelto en el expediente
    const dossier = await api().get(`/api/v1/properties/${await propertyId('ZUG-012')}/dossier`).set(bearer(mariana));
    expect(dossier.body.documents.some((d: { id: string }) => d.id === res.body.id)).toBe(false);
    // Un pagaré de otra casa
    const other = await pool.query(`SELECT n.id FROM promissory_notes n JOIN contracts ct ON ct.id = n.contract_id WHERE ct.property_id <> $1 LIMIT 1`, [await propertyId('ZUG-012')]);
    if (other.rows[0]) {
      const key2 = await upload(mariana, 'ZUG-012', 'document', 'application/pdf', PDF);
      const bad = await api().post('/api/v1/documents').set(bearer(mariana)).send({ ...doc, storageKey: key2, promissoryNoteId: other.rows[0].id });
      expect(bad.body.error.code).toBe('INVALID_NOTE');
    }
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
    // Contacto mutuo: el inquilino ve a su asesor, pero no las finanzas internas (gastos, bitácora)
    expect(c.body.broker).toMatchObject({ name: 'Mariana Solís' });
    expect(c.body).not.toHaveProperty('expenses');
    expect(c.body).not.toHaveProperty('activity');
    const s = await api().get(`/api/v1/properties/${id}/dossier`).set(bearer(mariana));
    expect(s.body.expenses.total).toBeGreaterThan(0);
    expect(s.body.tenant.name).toBe('Laura Mendez');
    expect((await api().get(`/api/v1/properties/${id}/dossier`).set(bearer(diego))).status).toBe(403);
  });

  test('eliminar documentos: administración sí; el broker solo lo oculta al cliente', async () => {
    const key = await upload(mariana, 'ZUG-012', 'document', 'application/pdf', PDF);
    const doc = await api().post('/api/v1/documents').set(bearer(mariana)).send({ propertyId: await propertyId('ZUG-012'), storageKey: key, type: 'other', name: 'Documento equivocado', mime: 'application/pdf', visibleToClient: true });
    expect((await api().delete(`/api/v1/documents/${doc.body.id}`).set(bearer(mariana))).status).toBe(403);
    const hide = await api().patch(`/api/v1/documents/${doc.body.id}`).set(bearer(mariana)).send({ visibleToClient: false });
    expect(hide.body.visibleToClient).toBe(false);
    expect((await api().get(`/api/v1/documents/${doc.body.id}/download-url`).set(bearer(laura))).status).toBe(404);
    expect((await api().delete(`/api/v1/documents/${doc.body.id}`).set(bearer(laura))).status).toBe(403);

    expect((await api().delete(`/api/v1/documents/${doc.body.id}`).set(bearer(admin))).status).toBe(204);
    expect((await api().get(`/api/v1/documents/${doc.body.id}/download-url`).set(bearer(admin))).status).toBe(404);
    expect((await pool.query('SELECT 1 FROM documents WHERE storage_key = $1', [key])).rowCount).toBe(0);
    const log = await pool.query(`SELECT description FROM activity_log WHERE entity = 'document' AND action = 'delete' AND entity_id = $1`, [doc.body.id]);
    expect(log.rows[0].description).toMatch(/eliminó «Documento equivocado»/);
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

  test('el propietario da de alta personal y decide si es broker, administrador o ambos; nadie más', async () => {
    expect((await api().get('/api/v1/users').set(bearer(mariana))).status).toBe(403);
    const res = await api().post('/api/v1/users').set(bearer(admin)).send({ name: 'Rocío Pech', email: 'rocio@zugar.example', roles: ['broker'], password: 'Rocio2026x' });
    expect(res.status).toBe(201);
    expect(res.body.roles).toEqual(['broker']);
    const both = await api().patch(`/api/v1/users/${res.body.id}`).set(bearer(admin)).send({ roles: ['broker', 'admin'] });
    expect([...both.body.roles].sort()).toEqual(['admin', 'broker']);
    const self = await api().patch(`/api/v1/users/${(await login(EMAILS.admin)).user.id}`).set(bearer(admin)).send({ active: false });
    expect(self.body.error.code).toBe('SELF_LOCKOUT');
    // Cambiar sus roles no le quita el de propietario.
    const owner = await api().patch(`/api/v1/users/${(await login(EMAILS.admin)).user.id}`).set(bearer(admin)).send({ roles: ['admin'] });
    expect([...owner.body.roles].sort()).toEqual(['admin', 'owner']);
    const roles = await api().get('/api/v1/users/roles').set(bearer(admin));
    expect(roles.body.roles.find((r: { code: string }) => r.code === 'owner').permissions).toContain('users.manage');
    expect(roles.body.roles.find((r: { code: string }) => r.code === 'admin').permissions).not.toContain('users.manage');
    // Una administradora que no es propietaria no gestiona al personal ni puede darse ese permiso.
    const rocio = (await login('rocio@zugar.example', 'Rocio2026x')).accessToken;
    expect((await api().get('/api/v1/users').set(bearer(rocio))).status).toBe(403);
    const grant = await api().put('/api/v1/users/roles/admin/permissions').set(bearer(admin)).send({ permissions: ['users.manage', 'payments.correct'] });
    expect(grant.body.permissions).toEqual(['payments.correct']);
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
    // Tres días antes del siguiente pagaré pendiente: así la prueba no depende de la fecha de hoy
    const { rows: [next] } = await pool.query<{ day: string }>(`SELECT to_char(min(due_date) - 3, 'YYYY-MM-DD') AS day FROM promissory_notes WHERE status = 'pending'`);
    const day = next.day;
    const first = await runDailyJobs(day);
    expect(first.noteReminders).toBeGreaterThan(0);
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

describe('Ventas (comprobante de cierre)', () => {
  let saleId: string;
  const laurasClient = async () => (await pool.query(`SELECT id FROM clients WHERE email = $1`, [EMAILS.laura])).rows[0].id;

  test('una casa en renta no se registra como venta; arriba de 8,025 UMA se exige revisar la identificación', async () => {
    const renta = await api().post('/api/v1/sales').set(bearer(admin)).send({ propertyId: await propertyId('ZUG-001'), clientId: await laurasClient(), saleDate: '2026-11-01', price: 900000 });
    expect(renta.status).toBe(409);
    expect(renta.body.error.code).toBe('NOT_FOR_SALE');
    const sinIne = await api().post('/api/v1/sales').set(bearer(admin)).send({ propertyId: await propertyId('ZUG-002'), clientId: await laurasClient(), saleDate: '2026-11-01', price: 4850000 });
    expect(sinIne.status).toBe(400);
    expect(sinIne.body.error.code).toBe('IDENTITY_REQUIRED');
    // El broker consulta, pero no registra
    expect((await api().post('/api/v1/sales').set(bearer(diego)).send({ propertyId: await propertyId('ZUG-002'), clientId: await laurasClient(), saleDate: '2026-11-01', price: 100 })).status).toBe(403);
  });

  test('registrar la venta: folio VEN-001, la casa queda vendida y pausada, y al comprador le llega el aviso', async () => {
    const patio = await propertyId('ZUG-002');
    const res = await api().post('/api/v1/sales').set(bearer(admin)).send({
      propertyId: patio, clientId: await laurasClient(), saleDate: '2026-11-01', price: 4850000, paymentMethod: 'Crédito bancario', notary: 'Notaría 30 de Cancún', identityChecked: true,
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ folio: 'VEN-001', status: 'closed', price: 4850000, antiMoneyLaundering: { requiresNotice: true } });
    saleId = res.body.id;
    expect((await pool.query('SELECT status, visibility FROM properties WHERE id = $1', [patio])).rows[0]).toEqual({ status: 'vendida', visibility: 'pausada' });
    expect((await notificationsOf(EMAILS.laura, 'sale_closed')).length).toBe(1);
    expect((await notificationsOf(EMAILS.diego, 'sale_closed')).length).toBe(1); // broker de la casa
    // Vendida: no se vuelve a publicar hasta anular la venta
    const pub = await api().patch(`/api/v1/properties/${patio}/availability`).set(bearer(admin)).send({ status: 'disponible', visibility: 'publicada' });
    expect(pub.status).toBe(409);
    expect(pub.body.error.code).toBe('CLOSED_SALE');
    // Dos ventas cerradas de la misma casa, no
    const dup = await api().post('/api/v1/sales').set(bearer(admin)).send({ propertyId: patio, clientId: await laurasClient(), saleDate: '2026-11-01', price: 100 });
    expect(dup.body.error.code).toBe('SALE_EXISTS');
  });

  test('el comprador ve su compra (sin datos internos) y descarga el comprobante en PDF', async () => {
    const mine = await api().get('/api/v1/sales').set(bearer(laura));
    expect(mine.status).toBe(200);
    expect(mine.body.data).toHaveLength(1);
    expect(mine.body.data[0]).toMatchObject({ folio: 'VEN-001', property: { code: 'ZUG-002' } });
    expect(mine.body.data[0].antiMoneyLaundering).toBeUndefined();
    expect(mine.body.data[0].notes).toBeUndefined();
    const url = await api().get(`/api/v1/sales/${saleId}/receipt-url`).set(bearer(laura));
    expect(url.status).toBe(200);
    const pdf = await api().get(new URL(url.body.url).pathname).buffer(true);
    expect(pdf.status).toBe(200);
    expect(Buffer.from(pdf.body).subarray(0, 5).toString()).toBe('%PDF-');
    // Otro cliente o un broker de otra casa no la ven
    expect((await api().get(`/api/v1/sales/${saleId}`).set(bearer(mariana))).status).toBe(403);
    expect((await api().get('/api/v1/sales').set(bearer(diego))).body.data).toHaveLength(1);
  });

  test('anular la venta deja la casa disponible y el comprobante marcado como anulado', async () => {
    const res = await api().post(`/api/v1/sales/${saleId}/void`).set(bearer(admin)).send({ reason: 'Se registró por error' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('voided');
    expect((await pool.query('SELECT status FROM properties WHERE id = $1', [await propertyId('ZUG-002')])).rows[0].status).toBe('disponible');
    expect((await api().post(`/api/v1/sales/${saleId}/void`).set(bearer(admin)).send({ reason: 'otra vez' })).body.error.code).toBe('SALE_VOIDED');
  });
});
