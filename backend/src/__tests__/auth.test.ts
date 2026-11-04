import { pool } from '../config/database.js';
import { sentMail } from '../services/mail.service.js';
import { MSG_INACTIVE, MSG_INVALID_LOGIN } from '../services/auth.service.js';
import { api, bearer, closeDatabase, EMAILS, login, PASSWORD, resetDatabase } from './helpers.js';

beforeAll(resetDatabase);
afterAll(closeDatabase);

describe('POST /auth/login', () => {
  test('inicia sesión y devuelve tokens, roles y permisos', async () => {
    const res = await api().post('/api/v1/auth/login').send({ email: 'LUCIA@zugar.example', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
    expect(res.body.expiresIn).toBe(900);
    expect(res.body.user).toMatchObject({ email: EMAILS.admin, type: 'staff' });
    expect([...res.body.user.roles].sort()).toEqual(['admin', 'owner']);
    expect(res.body.user.permissions).toContain('payments.correct');
    expect(res.body.user).not.toHaveProperty('password_hash');
  });

  test('contraseña incorrecta y correo inexistente dan el mismo mensaje genérico', async () => {
    const wrong = await api().post('/api/v1/auth/login').send({ email: EMAILS.mariana, password: 'Incorrecta1' });
    const unknown = await api().post('/api/v1/auth/login').send({ email: 'nadie@zugar.example', password: 'Incorrecta1' });
    for (const res of [wrong, unknown]) {
      expect(res.status).toBe(401);
      expect(res.body.error).toEqual({ code: 'INVALID_CREDENTIALS', message: MSG_INVALID_LOGIN, details: null });
    }
  });

  test('valida el cuerpo con mensajes por campo', async () => {
    const res = await api().post('/api/v1/auth/login').send({ email: 'no-es-correo' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(res.body.error.details)).toEqual(expect.arrayContaining(['email', 'password']));
  });

  test('5 intentos fallidos bloquean la cuenta aunque después la contraseña sea correcta', async () => {
    for (let i = 1; i <= 4; i++) {
      const res = await api().post('/api/v1/auth/login').send({ email: EMAILS.diego, password: `Mala${i}xx` });
      expect(res.status).toBe(401);
    }
    const fifth = await api().post('/api/v1/auth/login').send({ email: EMAILS.diego, password: 'Mala5xx' });
    expect(fifth.status).toBe(423);
    expect(fifth.body.error.code).toBe('ACCOUNT_LOCKED');
    expect(fifth.body.error.details.retryAfterMinutes).toBe(15);

    const correct = await api().post('/api/v1/auth/login').send({ email: EMAILS.diego, password: PASSWORD });
    expect(correct.status).toBe(423);

    const { rows } = await pool.query(`SELECT action FROM activity_log a JOIN users u ON u.id = a.user_id WHERE u.email = $1`, [EMAILS.diego]);
    expect(rows.map((r) => r.action)).toEqual(expect.arrayContaining(['login_failed', 'account_locked', 'login_blocked']));
  });

  test('cuenta inactiva: mensaje de la inmobiliaria', async () => {
    await pool.query('UPDATE users SET active = FALSE WHERE email = $1', [EMAILS.valeria]);
    const res = await api().post('/api/v1/auth/login').send({ email: EMAILS.valeria, password: PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({ code: 'ACCOUNT_INACTIVE', message: MSG_INACTIVE });
    await pool.query('UPDATE users SET active = TRUE WHERE email = $1', [EMAILS.valeria]);
  });
});

describe('POST /auth/register', () => {
  test('rechaza contraseñas que no cumplen la política', async () => {
    const res = await api().post('/api/v1/auth/register').send({ consent: true, name: 'Pedro Pérez', email: 'pedro@correo.com', phone: '998 111 2233', password: 'corta' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.password).toEqual(
      expect.arrayContaining(['La contraseña debe tener al menos 8 caracteres.', 'La contraseña debe incluir al menos una mayúscula.', 'La contraseña debe incluir al menos un número.']),
    );
  });

  test('rechaza correos ya registrados', async () => {
    const res = await api().post('/api/v1/auth/register').send({ consent: true, name: 'Otra Laura', email: EMAILS.laura, phone: '998 111 2233', password: 'NuevaClave1' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  test('crea una cuenta de cliente y vincula el expediente que ya existía con ese correo', async () => {
    const res = await api().post('/api/v1/auth/register').send({ consent: true, name: 'Ana García López', email: 'ana@example.com', phone: '998 000 0123', password: 'AnaClave2026' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ type: 'client', roles: [], permissions: [] });

    const me = await api().get('/api/v1/users/me').set(bearer(res.body.accessToken));
    const { rows } = await pool.query(`SELECT id FROM clients WHERE email = 'ana@example.com'`);
    expect(rows).toHaveLength(1);
    expect(me.body.client.id).toBe(rows[0].id);
  });
});

describe('Sesión: refresh, logout y cambio de contraseña', () => {
  test('el refresh rota el token; reutilizar uno viejo cierra todas las sesiones', async () => {
    const first = await login(EMAILS.mariana);
    const rotated = await api().post('/api/v1/auth/refresh').send({ refreshToken: first.refreshToken });
    expect(rotated.status).toBe(200);
    expect(rotated.body.refreshToken).not.toBe(first.refreshToken);

    const reuse = await api().post('/api/v1/auth/refresh').send({ refreshToken: first.refreshToken });
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe('INVALID_REFRESH_TOKEN');

    // Por la reutilización, también el token nuevo quedó revocado.
    const after = await api().post('/api/v1/auth/refresh').send({ refreshToken: rotated.body.refreshToken });
    expect(after.status).toBe(401);
  });

  test('logout revoca el refresh token', async () => {
    const s = await login(EMAILS.mariana);
    const out = await api().post('/api/v1/auth/logout').set(bearer(s.accessToken)).send({ refreshToken: s.refreshToken });
    expect(out.status).toBe(204);
    const res = await api().post('/api/v1/auth/refresh').send({ refreshToken: s.refreshToken });
    expect(res.status).toBe(401);
  });

  test('cambiar contraseña exige la actual y luego solo sirve la nueva', async () => {
    const s = await login(EMAILS.mariana);
    const wrong = await api().post('/api/v1/auth/change-password').set(bearer(s.accessToken)).send({ currentPassword: 'Otra1234', newPassword: 'Mariana2027' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.code).toBe('INVALID_CURRENT_PASSWORD');

    const ok = await api().post('/api/v1/auth/change-password').set(bearer(s.accessToken)).send({ currentPassword: PASSWORD, newPassword: 'Mariana2027' });
    expect(ok.status).toBe(200);
    expect((await api().post('/api/v1/auth/login').send({ email: EMAILS.mariana, password: PASSWORD })).status).toBe(401);
    expect((await api().post('/api/v1/auth/login').send({ email: EMAILS.mariana, password: 'Mariana2027' })).status).toBe(200);
    // Las sesiones anteriores se cerraron.
    expect((await api().post('/api/v1/auth/refresh').send({ refreshToken: s.refreshToken })).status).toBe(401);
  });
});

/** Contraseña temporal del correo (Zug-xxxx-NNxxxx) */
const tempOf = (mail: { text: string }) => /(Zug-[A-Za-z0-9]{4}-\d{2}[A-Za-z0-9]{4})/.exec(mail.text)![1];

describe('Recuperación de contraseña', () => {
  test('responde igual exista o no el correo', async () => {
    const before = sentMail.length;
    const res = await api().post('/api/v1/auth/forgot-password').send({ email: 'nadie@zugar.example' });
    expect(res.status).toBe(200);
    expect(sentMail.length).toBe(before);
  });

  test('contraseña temporal: entra con ella, debe crear la suya y la temporal no se vuelve a usar', async () => {
    const res = await api().post('/api/v1/auth/forgot-password').send({ email: EMAILS.laura });
    expect(res.status).toBe(200);
    const mail = sentMail[sentMail.length - 1];
    expect(mail.to).toBe(EMAILS.laura);
    const temp = tempOf(mail);
    // La contraseña de siempre sigue sirviendo mientras no use la temporal
    const before = await api().post('/api/v1/auth/login').send({ email: EMAILS.laura, password: 'Zugar2026!' });
    expect(before.status).toBe(200);
    expect(before.body.user.mustChangePassword).toBe(false);

    const s = await api().post('/api/v1/auth/login').send({ email: EMAILS.laura, password: temp });
    expect(s.status).toBe(200);
    expect(s.body.user.mustChangePassword).toBe(true);
    expect((await api().get('/api/v1/users/me').set(bearer(s.body.accessToken))).body.mustChangePassword).toBe(true);
    // Ya canjeada, la anterior deja de servir
    expect((await api().post('/api/v1/auth/login').send({ email: EMAILS.laura, password: 'Zugar2026!' })).status).toBe(401);

    // Crea la suya: recibe una sesión nueva y ya no se le pide
    const changed = await api().post('/api/v1/auth/change-password').set(bearer(s.body.accessToken)).send({ currentPassword: temp, newPassword: 'LauraNueva2026' });
    expect(changed.status).toBe(200);
    expect(changed.body.user.mustChangePassword).toBe(false);
    expect((await api().get('/api/v1/users/me').set(bearer(changed.body.accessToken))).status).toBe(200);
    expect((await api().post('/api/v1/auth/login').send({ email: EMAILS.laura, password: temp })).status).toBe(401);
    expect((await api().post('/api/v1/auth/login').send({ email: EMAILS.laura, password: 'LauraNueva2026' })).body.user.mustChangePassword).toBe(false);
  });

  test('el botón del correo abre la app (clientes, con su correo) o el panel (personal)', async () => {
    await api().post('/api/v1/auth/forgot-password').send({ email: EMAILS.laura });
    expect(sentMail[sentMail.length - 1].action!.url).toMatch(/:5600\/\?email=lau\.mendez%40correo\.com$/);
    await api().post('/api/v1/auth/forgot-password').send({ email: EMAILS.mariana });
    expect(sentMail[sentMail.length - 1].action!.url).toMatch(/\/admin\/#\/login$/);
    // Pedir otra invalida la anterior
    const first = tempOf(sentMail[sentMail.length - 1]);
    await api().post('/api/v1/auth/forgot-password').send({ email: EMAILS.mariana });
    expect((await api().post('/api/v1/auth/login').send({ email: EMAILS.mariana, password: first })).status).toBe(401);
  });

  test('un formulario del sitio crea la cuenta sola: entra con la temporal del correo, crea la suya y ve su solicitud', async () => {
    const email = 'nueva.persona@correo.com';
    const lead = await api().post('/api/v1/public/leads').send({ consent: true, reason: 'rentar', name: 'Nueva Persona', email, phone: '998 111 2233', payload: { presupuesto_min: 10000, presupuesto_max: 20000 } });
    expect(lead.status).toBe(201);
    expect(lead.body.account).toBe('created');
    const mail = sentMail[sentMail.length - 1];
    expect(mail.to).toBe(email);
    expect(mail.subject).toMatch(/Tu cuenta de Homiz/);
    const temp = tempOf(mail);
    expect((await api().post('/api/v1/auth/login').send({ email, password: 'Cualquiera2026' })).status).toBe(401);
    const first = (await api().post('/api/v1/auth/login').send({ email, password: temp })).body;
    expect(first.user).toMatchObject({ type: 'client', mustChangePassword: true });
    const s = (await api().post('/api/v1/auth/change-password').set(bearer(first.accessToken)).send({ currentPassword: temp, newPassword: 'MiClave2026' })).body;
    expect(s.user.mustChangePassword).toBe(false);
    const mine = await api().get('/api/v1/requests').set(bearer(s.accessToken));
    expect(mine.body.data[0].folio).toBe(lead.body.folio);
    // Una segunda solicitud con el mismo correo no crea otra cuenta
    const again = await api().post('/api/v1/public/leads').send({ consent: true, reason: 'otro', name: 'Nueva Persona', email, message: 'Una duda' });
    expect(again.body.account).toBe('existing');
  });
});

describe('/users/me', () => {
  test('el cliente ve su expediente sin datos del broker y puede editar su perfil', async () => {
    const s = await login(EMAILS.laura, 'LauraNueva2026');
    const me = await api().get('/api/v1/users/me').set(bearer(s.accessToken));
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ name: 'Laura Mendez', birthDate: '1995-03-15', type: 'client' });
    expect(me.body.client).toMatchObject({ budget: '$12,000 MXN / mes', hasPets: true, petsCount: 1, occupants: 3 });
    expect(JSON.stringify(me.body)).not.toMatch(/broker|Mariana/i);

    const upd = await api().patch('/api/v1/users/me').set(bearer(s.accessToken)).send({ phone: '+52 998 123 4567' });
    expect(upd.status).toBe(200);
    expect(upd.body.phone).toBe('+52 998 123 4567');
  });

  test('el cliente edita «Mis datos» de su expediente; el personal no tiene expediente', async () => {
    const s = await login(EMAILS.laura, 'LauraNueva2026');
    const upd = await api().patch('/api/v1/users/me').set(bearer(s.accessToken)).send({ client: { budgetAmount: 15000, hasPets: false, petsCount: 2, occupants: 4 } });
    expect(upd.status).toBe(200);
    expect(upd.body.client).toMatchObject({ budget: '$15,000 MXN / mes', budgetAmount: 15000, hasPets: false, petsCount: 0, occupants: 4 });
    await api().patch('/api/v1/users/me').set(bearer(s.accessToken)).send({ client: { budgetAmount: 12000, hasPets: true, petsCount: 1, occupants: 3 } });

    const staff = await login(EMAILS.admin);
    const bad = await api().patch('/api/v1/users/me').set(bearer(staff.accessToken)).send({ client: { occupants: 2 } });
    expect(bad.status).toBe(400);
  });

  test('un token alterado o ausente no entra', async () => {
    const s = await login(EMAILS.admin);
    expect((await api().get('/api/v1/users/me')).status).toBe(401);
    expect((await api().get('/api/v1/users/me').set(bearer(s.accessToken + 'x'))).status).toBe(401);
  });

  test('si la cuenta se desactiva, el token deja de servir de inmediato', async () => {
    const s = await login(EMAILS.valeria);
    await pool.query('UPDATE users SET active = FALSE WHERE email = $1', [EMAILS.valeria]);
    const res = await api().get('/api/v1/users/me').set(bearer(s.accessToken));
    expect(res.status).toBe(403);
    await pool.query('UPDATE users SET active = TRUE WHERE email = $1', [EMAILS.valeria]);
  });
});
