import { pool } from '../config/database.js';
import { runDailyJobs } from '../jobs/daily.job.js';
import { api, bearer, closeDatabase, EMAILS, login, propertyId, resetDatabase } from './helpers.js';

/* Fase 4 (decisiones 111–113): inquilinos solo por administración, fotos de sellos en los pagarés y servicios de agua y luz. */

let admin: string, mariana: string, laura: string;
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4d50000000049454e44ae426082', 'hex');

beforeAll(async () => {
  await resetDatabase();
  admin = (await login(EMAILS.admin)).accessToken;
  mariana = (await login(EMAILS.mariana)).accessToken;
  laura = (await login(EMAILS.laura)).accessToken;
});
afterAll(closeDatabase);

describe('fotos de los sellos del pagaré', () => {
  let noteId: string;

  test('el personal sube la foto del sello y el inquilino la ve en su pagaré', async () => {
    const notes = await api().get('/api/v1/promissory-notes').set(bearer(laura));
    noteId = notes.body.data[0].id;
    const pid = await propertyId('ZUG-012');
    const up = await api().post('/api/v1/documents/upload-url').set(bearer(mariana)).send({ propertyId: pid, purpose: 'document', mime: 'image/png', size: PNG.length });
    expect(up.status).toBe(201);
    expect((await api().put(new URL(up.body.upload.url).pathname).set('Content-Type', 'image/png').send(PNG)).status).toBe(201);
    const doc = await api().post('/api/v1/documents').set(bearer(mariana)).send({
      propertyId: pid, storageKey: up.body.storageKey, type: 'stamp', name: 'Sello pagaré 05', mime: 'image/png', visibleToClient: true, promissoryNoteId: noteId,
    });
    expect(doc.status).toBe(201);
    const mine = (await api().get('/api/v1/promissory-notes').set(bearer(laura))).body.data.find((n: { id: string }) => n.id === noteId);
    expect(mine.stamps).toEqual([expect.objectContaining({ id: doc.body.id, name: 'Sello pagaré 05' })]);
    expect(mine.proofDocumentId).toBeNull(); // el sello no se confunde con el comprobante de pago
    const file = await api().get(`/api/v1/documents/${doc.body.id}/download-url`).set(bearer(laura));
    expect(file.status).toBe(200);
    expect(file.body.url).toEqual(expect.any(String));
  });

  test('la foto del sello debe ser imagen y estar ligada a un pagaré', async () => {
    const pid = await propertyId('ZUG-012');
    const noNote = await api().post('/api/v1/documents').set(bearer(mariana)).send({ propertyId: pid, storageKey: 'properties/ZUG-012/documents/00000000-0000-4000-8000-000000000000.png', type: 'stamp', name: 'Sello', mime: 'image/png' });
    expect(noNote.status).toBe(400);
  });
});

describe('«¿Qué quieres hacer?» en la app (QR de una casa)', () => {
  test('la solicitud con casa, día y hora agenda la cita', async () => {
    const reg = await api().post('/api/v1/auth/register').send({ consent: true, name: 'Rosa Pech', email: 'rosa.pech@example.com', phone: '998 123 4455', password: 'Rosa2026!' });
    expect(reg.status).toBe(201);
    const token = reg.body.accessToken;
    const d = new Date(Date.now() + 9 * 86400000).toISOString().slice(0, 10);
    const res = await api().post('/api/v1/requests').set(bearer(token)).send({
      reason: 'rentar', propertySlug: 'casa-chaka', preferredDate: d, preferredTime: '10:15',
      payload: { tipo_inmueble: 'Casa', presupuesto_max: 30000, recamaras: '3', mascotas: 'no' },
    });
    expect(res.status).toBe(201);
    const act = await api().get('/api/v1/appointments/active').set(bearer(token));
    expect(act.body.appointment).toMatchObject({ status: 'por-confirmar', property: expect.objectContaining({ code: 'ZUG-008' }) });
    // Sin hora no se acepta una fecha
    expect((await api().post('/api/v1/requests').set(bearer(token)).send({ reason: 'rentar', propertySlug: 'casa-chaka', preferredDate: d })).status).toBe(400);
  });
});

describe('todo de la persona en el panel', () => {
  test('resumen: solicitudes, citas, contrato con pagarés y sellos, y bitácora', async () => {
    const lauraClient = (await pool.query(`SELECT c.id FROM clients c JOIN users u ON u.id = c.user_id WHERE u.email = $1`, [EMAILS.laura])).rows[0].id;
    const res = await api().get(`/api/v1/clients/${lauraClient}/overview`).set(bearer(admin));
    expect(res.status).toBe(200);
    expect(res.body.client.code).toMatch(/^CLI-\d{4}$/);
    expect(res.body.appointments.some((a: { code: string }) => a.code === 'CIT-019')).toBe(true);
    expect(res.body.contracts[0]).toMatchObject({ propertyCode: 'ZUG-012', status: 'active', notesTotal: 12, notesPaid: 4, stamps: 1 });
    expect(Array.isArray(res.body.leads)).toBe(true);
    expect(Array.isArray(res.body.activity)).toBe(true);
    // Un broker que no la atiende no la ve
    const diego = (await login(EMAILS.diego)).accessToken;
    expect((await api().get(`/api/v1/clients/${lauraClient}/overview`).set(bearer(diego))).status).toBe(404);
  });
});

describe('eliminar mi cuenta (derecho de cancelación)', () => {
  test('desde la app con su contraseña: se anonimizan sus datos, se cancelan sus citas y ya no puede entrar', async () => {
    const email = 'borrame@correo.com';
    const reg = await api().post('/api/v1/auth/register').send({ consent: true, name: 'Borra Me', email, phone: '998 555 0000', password: 'ClaveSegura1' });
    expect(reg.status).toBe(201);
    const token = reg.body.accessToken;
    await api().post('/api/v1/public/leads').send({ consent: true, reason: 'rentar', name: 'Borra Me', email, phone: '998 555 0000', message: 'Busco casa' });
    expect((await api().delete('/api/v1/users/me').set(bearer(token)).send({ password: 'otra' })).status).toBe(401);
    expect((await api().delete('/api/v1/users/me').set(bearer(token)).send({ password: 'ClaveSegura1' })).status).toBe(204);
    expect((await api().post('/api/v1/auth/login').send({ email, password: 'ClaveSegura1' })).status).toBe(401);
    expect((await api().get('/api/v1/users/me').set(bearer(token))).status).not.toBe(200);
    expect((await pool.query(`SELECT 1 FROM users WHERE email = $1`, [email])).rowCount).toBe(0);
    expect((await pool.query(`SELECT 1 FROM leads WHERE email = $1 OR name = 'Borra Me' OR message = 'Busco casa'`, [email])).rowCount).toBe(0);
  });

  test('desde el sitio con correo y contraseña; con contrato vigente no se puede', async () => {
    const r = await api().post('/api/v1/auth/delete-account').send({ email: EMAILS.laura, password: 'Zugar2026!' });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('HAS_ACTIVE_CONTRACT');
    expect((await api().post('/api/v1/auth/delete-account').send({ email: 'nadie@correo.com', password: 'x' })).status).toBe(401);
    // El personal no se da de baja así
    expect((await api().post('/api/v1/auth/delete-account').send({ email: EMAILS.mariana, password: 'Zugar2026!' })).status).toBe(403);
  });
});

describe('formularios públicos: consentimiento y abuso', () => {
  const base = { reason: 'rentar', name: 'Prueba Abuso', email: 'abuso@correo.com' };
  test('sin aceptar el aviso de privacidad no se reciben datos; al aceptarlo queda registrado', async () => {
    const no = await api().post('/api/v1/public/leads').send(base);
    expect(no.status).toBe(400);
    const ok = await api().post('/api/v1/public/leads').send({ ...base, consent: true });
    expect(ok.status).toBe(201);
    const { rows } = await pool.query(`SELECT payload FROM leads WHERE folio = $1`, [ok.body.folio]);
    expect(rows[0].payload.aviso_privacidad).toMatch(/^Aceptado .* versión \d{4}-\d{2}-\d{2}$/);
  });

  test('un robot que llena el campo trampa no crea nada; el mismo correo no puede mandar muchas seguidas', async () => {
    const before = (await pool.query(`SELECT count(*)::int AS n FROM leads`)).rows[0].n;
    const bot = await api().post('/api/v1/public/leads').send({ ...base, email: 'robot@correo.com', consent: true, website: 'http://spam' });
    expect(bot.status).toBe(201);
    expect((await pool.query(`SELECT count(*)::int AS n FROM leads`)).rows[0].n).toBe(before);
    expect((await pool.query(`SELECT 1 FROM users WHERE email = 'robot@correo.com'`)).rowCount).toBe(0);
    for (let i = 0; i < 4; i++) await api().post('/api/v1/public/leads').send({ ...base, consent: true });
    const many = await api().post('/api/v1/public/leads').send({ ...base, consent: true });
    expect(many.status).toBe(429);
  });
});

describe('archivos: el contenido debe ser el que dice ser', () => {
  test('un HTML disfrazado de PDF se rechaza; el tipo declarado debe coincidir con la extensión', async () => {
    const pid = await propertyId('ZUG-012');
    const up = await api().post('/api/v1/documents/upload-url').set(bearer(mariana)).send({ propertyId: pid, purpose: 'document', mime: 'application/pdf', size: 40 });
    const fake = Buffer.from('<html><script>alert(1)</script></html>');
    const put = await api().put(new URL(up.body.upload.url).pathname).set('Content-Type', 'application/pdf').send(fake);
    expect(put.status).toBe(400);
    expect(put.body.error.code).toBe('INVALID_FILE_CONTENT');
    // Con un PNG real, declararlo como text/html al registrarlo también se rechaza
    const up2 = await api().post('/api/v1/documents/upload-url').set(bearer(mariana)).send({ propertyId: pid, purpose: 'document', mime: 'image/png', size: PNG.length });
    expect((await api().put(new URL(up2.body.upload.url).pathname).set('Content-Type', 'image/png').send(PNG)).status).toBe(201);
    const bad = await api().post('/api/v1/documents').set(bearer(mariana)).send({ propertyId: pid, storageKey: up2.body.storageKey, type: 'other', name: 'Truco', mime: 'text/html', visibleToClient: false });
    expect(bad.status).toBe(400);
  });
});

describe('privacidad entre inquilinos de la misma casa', () => {
  test('el inquilino no ve lo del contrato de otro (documentos, reportes y recibos); sí lo general de la casa', async () => {
    const pid = await propertyId('ZUG-012');
    // Un inquilino anterior en la misma casa, con su contrato ya finalizado y sus documentos
    const { rows: [old] } = await pool.query(
      `INSERT INTO clients (name, email, kind, property_id) VALUES ('Inquilino Anterior', 'anterior@correo.com', 'cliente', $1) RETURNING id`, [pid]);
    const { rows: [oldCt] } = await pool.query(
      `INSERT INTO contracts (property_id, client_id, start_date, end_date, monthly_rent, payment_day, status, created_at)
       VALUES ($1, $2, '2024-01-01', '2024-12-31', 10000, 5, 'finished', '2024-01-01') RETURNING id`, [pid, old.id]);
    const doc = (type: string, contractId: string | null, created: string) => pool.query(
      `INSERT INTO documents (property_id, type, name, storage_key, mime, size, visible_to_client, contract_id, created_at)
       VALUES ($1, $2, $3, $4, 'application/pdf', 10, TRUE, $5, $6) RETURNING id`,
      [pid, type, `${type} ${created}`, `properties/ZUG-012/documents/${crypto.randomUUID()}.pdf`, contractId, created]);
    const ajeno = (await doc('contract', oldCt.id, '2024-01-02')).rows[0].id; // contrato del anterior
    const viejo = (await doc('other', null, '2024-02-01')).rows[0].id; // suelto de antes de su contrato
    const reglamento = (await doc('rules', null, '2024-01-03')).rows[0].id; // general de la casa
    await pool.query(`INSERT INTO maintenance_reports (property_id, client_id, title, description, category, priority, created_at)
                      VALUES ($1, $2, 'Reporte del anterior', 'Fuga vieja', 'Plomería', 'low', '2024-03-01')`, [pid, old.id]);

    const docs = (await api().get('/api/v1/documents?limit=100').set(bearer(laura))).body.data.map((d: { id: string }) => d.id);
    expect(docs).not.toContain(ajeno);
    expect(docs).not.toContain(viejo);
    expect(docs).toContain(reglamento);
    expect((await api().get(`/api/v1/documents/${ajeno}/download-url`).set(bearer(laura))).status).toBe(404);
    const dossier = (await api().get(`/api/v1/properties/${pid}/dossier`).set(bearer(laura))).body;
    expect(JSON.stringify(dossier)).not.toMatch(/Reporte del anterior|contract 2024-01-02/);
    const reports = (await api().get('/api/v1/maintenance-reports?limit=100').set(bearer(laura))).body.data;
    expect(reports.map((r: { title: string }) => r.title)).not.toContain('Reporte del anterior');
    // El personal sí ve todo el historial de la casa
    expect((await api().get(`/api/v1/documents/${ajeno}/download-url`).set(bearer(admin))).status).toBe(200);
  });

  test('marcar «inquilino» a mano no da acceso a la casa (solo un contrato vigente)', async () => {
    const pid = await propertyId('ZUG-001');
    const { rows: [lc] } = await pool.query(`SELECT id FROM clients WHERE email = $1`, [EMAILS.laura]);
    const { rows: [before] } = await pool.query('SELECT property_id, kind FROM clients WHERE id = $1', [lc.id]);
    expect((await api().get(`/api/v1/properties/${pid}/dossier`).set(bearer(laura))).status).toBe(403);
    await pool.query(`UPDATE clients SET kind = 'inquilino', property_id = $2 WHERE id = $1`, [lc.id, pid]);
    expect((await api().get(`/api/v1/properties/${pid}/dossier`).set(bearer(laura))).status).toBe(403);
    await pool.query('UPDATE clients SET kind = $2, property_id = $3 WHERE id = $1', [lc.id, before.kind, before.property_id]);
  });
});

describe('servicios de agua y luz', () => {
  test('solo administración captura los números de servicio; el inquilino los ve en su expediente', async () => {
    const pid = await propertyId('ZUG-012');
    expect((await api().patch(`/api/v1/properties/${pid}`).set(bearer(mariana)).send({ electricityServiceNumber: '123456789012' })).status).toBe(403);
    const ok = await api().patch(`/api/v1/properties/${pid}`).set(bearer(admin)).send({ electricityServiceNumber: '123456789012', waterServiceNumber: 'AK-778899', utilityReminderDay: 3 });
    expect(ok.status).toBe(200);
    expect(ok.body.utilities).toEqual({ electricityServiceNumber: '123456789012', waterServiceNumber: 'AK-778899', reminderDay: 3 });
    const dossier = (await api().get(`/api/v1/properties/${pid}/dossier`).set(bearer(laura))).body;
    expect(dossier.utilities.electricity).toMatchObject({ company: 'CFE', serviceNumber: '123456789012' });
    expect(dossier.utilities.water).toMatchObject({ company: 'Aguakan', serviceNumber: 'AK-778899' });
    expect(dossier.broker).toMatchObject({ name: 'Mariana Solís', email: EMAILS.mariana });
    // El catálogo del cliente no muestra números de servicio
    expect((await api().get(`/api/v1/properties/${pid}`).set(bearer(laura))).body).not.toHaveProperty('utilities');
  });

  test('el día elegido se le recuerda al inquilino revisar sus recibos (una vez al día)', async () => {
    const first = await runDailyJobs('2026-11-03');
    expect(first.utilityReminders).toBe(1);
    const again = await runDailyJobs('2026-11-03');
    expect(again.utilityReminders).toBe(0);
    const { rows } = await pool.query(
      `SELECT n.message FROM notifications n JOIN users u ON u.id = n.user_id WHERE u.email = $1 AND n.type = 'utility_reminder'`,
      [EMAILS.laura],
    );
    expect(rows[0].message).toMatch(/CFE Contigo.*123456789012.*Aguakan.*AK-778899/);
  });

  test('cuota de mantenimiento: la captura administración y ese día se avisa a administración, al broker y al inquilino', async () => {
    const pid = await propertyId('ZUG-012');
    expect((await api().patch(`/api/v1/properties/${pid}`).set(bearer(mariana)).send({ maintenanceFee: 1500, maintenanceFeeDay: 10 })).status).toBe(403);
    const ok = await api().patch(`/api/v1/properties/${pid}`).set(bearer(admin)).send({ maintenanceFee: 1500, maintenanceFeeDay: 10 });
    expect(ok.body.maintenanceFee).toEqual({ amount: 1500, day: 10 });
    expect((await runDailyJobs('2026-11-10')).maintenanceFeeReminders).toBe(1);
    expect((await runDailyJobs('2026-11-10')).maintenanceFeeReminders).toBe(0);
    const who = await pool.query(`SELECT u.email FROM notifications n JOIN users u ON u.id = n.user_id WHERE n.type = 'maintenance_fee'`);
    expect(who.rows.map((r) => r.email)).toEqual(expect.arrayContaining([EMAILS.laura, EMAILS.mariana]));
  });
});
