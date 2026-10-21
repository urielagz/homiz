import { env } from '../config/env.js';
import { withTransaction } from '../config/database.js';
import { AppError } from '../middlewares/error-handler.js';
import * as Users from '../models/user.model.js';
import * as Clients from '../models/client.model.js';
import * as Tokens from '../models/token.model.js';
import { insertActivity } from '../models/activity.model.js';
import { hashPassword, verifyAgainstDummy, verifyPassword } from './password.service.js';
import {
  accessTokenSeconds,
  createOpaqueToken,
  hashOpaqueToken,
  refreshExpiry,
  signAccessToken,
} from './token.service.js';
import { sendMail } from './mail.service.js';

export const MSG_INVALID_LOGIN = 'El correo o la contraseña son inválidos, intente de nuevo.';
export const MSG_INACTIVE = 'Su cuenta no está activa, comuníquese con la inmobiliaria.';
export const MSG_FORGOT = 'Si el correo está registrado, recibirás un enlace para crear una nueva contraseña.';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  birthDate: string | null;
  type: 'client' | 'staff';
  initials: string | null;
  roles: string[];
  permissions: string[];
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: PublicUser;
}

export async function toPublicUser(u: Users.UserRow): Promise<PublicUser> {
  const access = u.type === 'staff' ? await Users.loadAccess(u.id) : { roles: [], permissions: [] };
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    birthDate: u.birth_date,
    type: u.type,
    initials: u.initials,
    roles: access.roles,
    permissions: access.permissions,
  };
}

async function issueSession(u: Users.UserRow): Promise<Session> {
  const { token, hash } = createOpaqueToken();
  await Tokens.insertRefreshToken(u.id, hash, refreshExpiry());
  return {
    accessToken: signAccessToken({ sub: u.id, type: u.type }),
    refreshToken: token,
    expiresIn: accessTokenSeconds(),
    user: await toPublicUser(u),
  };
}

function lockedError(until: Date): AppError {
  // El fin del bloqueo lo calcula la base (now()); si su reloj va unos milisegundos adelante del de Node,
  // el redondeo daría un minuto de más. Nunca se informa más que la duración configurada.
  const minutes = Math.min(env.LOGIN_LOCK_MINUTES, Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60000)));
  return new AppError(423, 'ACCOUNT_LOCKED', `Por seguridad tu cuenta está bloqueada. Intenta de nuevo en ${minutes} minuto${minutes === 1 ? '' : 's'}.`, {
    retryAfterMinutes: minutes,
  });
}

/** Inicio de sesión con bloqueo tras varios intentos y registro en el historial. */
export async function login(email: string, password: string): Promise<Session> {
  const user = await Users.findByEmail(email);
  if (!user) {
    await verifyAgainstDummy(password);
    await insertActivity({ entity: 'auth', action: 'login_failed', description: 'Intento de acceso con un correo no registrado.' });
    throw new AppError(401, 'INVALID_CREDENTIALS', MSG_INVALID_LOGIN);
  }
  if (user.locked_until && user.locked_until.getTime() > Date.now()) {
    await insertActivity({ userId: user.id, entity: 'auth', action: 'login_blocked', description: 'Intento de acceso con la cuenta bloqueada.' });
    throw lockedError(user.locked_until);
  }
  if (!(await verifyPassword(user.password_hash, password))) {
    const lockedUntil = await Users.registerFailedAttempt(user.id, env.LOGIN_MAX_ATTEMPTS, env.LOGIN_LOCK_MINUTES);
    const nowLocked = !!lockedUntil && lockedUntil.getTime() > Date.now();
    await insertActivity({
      userId: user.id,
      entity: 'auth',
      action: nowLocked ? 'account_locked' : 'login_failed',
      description: nowLocked ? 'Cuenta bloqueada por intentos fallidos.' : 'Contraseña incorrecta.',
    });
    if (nowLocked) throw lockedError(lockedUntil);
    throw new AppError(401, 'INVALID_CREDENTIALS', MSG_INVALID_LOGIN);
  }
  if (!user.active) {
    await insertActivity({ userId: user.id, entity: 'auth', action: 'login_inactive', description: 'Intento de acceso con cuenta inactiva.' });
    throw new AppError(403, 'ACCOUNT_INACTIVE', MSG_INACTIVE);
  }
  await Users.resetAttempts(user.id);
  await insertActivity({ userId: user.id, entity: 'auth', action: 'login_success', description: 'Inicio de sesión.' });
  return issueSession(user);
}

/** Registro de clientes desde la app: crea el usuario y su expediente (o vincula el existente). */
export async function register(data: { name: string; email: string; phone: string | null; password: string }): Promise<Session> {
  if (await Users.findByEmail(data.email)) {
    throw new AppError(409, 'EMAIL_TAKEN', 'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.');
  }
  const passwordHash = await hashPassword(data.password);
  const user = await withTransaction(async (db) => {
    const u = await Users.createUser({ ...data, passwordHash, type: 'client' }, db);
    const clientId = await Clients.linkOrCreateForUser(u, db);
    await insertActivity({ userId: u.id, entity: 'client', entityId: clientId, action: 'register', description: 'Cuenta de cliente creada desde la app.' }, db);
    return u;
  }).catch((err) => {
    if (err?.code === '23505') throw new AppError(409, 'EMAIL_TAKEN', 'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.');
    throw err;
  });
  return issueSession(user);
}

/**
 * Rotación del refresh token: cada uso entrega uno nuevo y revoca el anterior.
 * Si alguien presenta un token ya revocado (posible robo), se cierran todas las sesiones del usuario.
 */
export async function refresh(refreshToken: string): Promise<Session> {
  const invalid = new AppError(401, 'INVALID_REFRESH_TOKEN', 'Tu sesión expiró. Inicia sesión de nuevo.');
  const row = await Tokens.findRefreshToken(hashOpaqueToken(refreshToken));
  if (!row) throw invalid;
  if (row.revoked_at) {
    await Tokens.revokeAllForUser(row.user_id);
    await insertActivity({ userId: row.user_id, entity: 'auth', action: 'refresh_reuse', description: 'Se reutilizó un token revocado; se cerraron todas las sesiones.' });
    throw invalid;
  }
  if (row.expires_at.getTime() <= Date.now()) throw invalid;
  if (!(await Tokens.revokeRefreshToken(row.id))) throw invalid;
  const user = await Users.findById(row.user_id);
  if (!user) throw invalid;
  if (!user.active) throw new AppError(403, 'ACCOUNT_INACTIVE', MSG_INACTIVE);
  return issueSession(user);
}

/** Cierra la sesión: revoca el refresh token presentado (o todas si allDevices). */
export async function logout(userId: string, refreshToken: string | undefined, allDevices: boolean): Promise<void> {
  if (allDevices) {
    await Tokens.revokeAllForUser(userId);
  } else if (refreshToken) {
    const row = await Tokens.findRefreshToken(hashOpaqueToken(refreshToken));
    if (row && row.user_id === userId) await Tokens.revokeRefreshToken(row.id);
  }
  await insertActivity({ userId, entity: 'auth', action: 'logout', description: allDevices ? 'Cerró sesión en todos los dispositivos.' : 'Cerró sesión.' });
}

export async function changePassword(userId: string, current: string, next: string): Promise<void> {
  const user = await Users.findById(userId);
  if (!user || !(await verifyPassword(user.password_hash, current))) {
    throw new AppError(400, 'INVALID_CURRENT_PASSWORD', 'La contraseña actual no es correcta.');
  }
  if (current === next) throw new AppError(400, 'SAME_PASSWORD', 'La nueva contraseña debe ser distinta de la actual.');
  await Users.updatePassword(userId, await hashPassword(next));
  await Tokens.revokeAllForUser(userId);
  await insertActivity({ userId, entity: 'auth', action: 'password_changed', description: 'Cambió su contraseña.' });
}

/** Siempre responde igual, exista o no el correo, para no revelar qué cuentas existen. */
export async function forgotPassword(email: string): Promise<void> {
  const user = await Users.findByEmail(email);
  if (!user || !user.active) return;
  const { token, hash } = createOpaqueToken();
  const expiresAt = new Date(Date.now() + env.PASSWORD_RESET_MINUTES * 60000);
  await Tokens.insertPasswordReset(user.id, hash, expiresAt);
  await insertActivity({ userId: user.id, entity: 'auth', action: 'password_reset_requested', description: 'Solicitó recuperar su contraseña.' });
  const link = `${env.APP_RESET_URL}${env.APP_RESET_URL.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
  await sendMail({
    to: user.email,
    subject: 'Recupera tu acceso a Zugar',
    text:
      `Hola, ${user.name.split(' ')[0]}:\n\n` +
      `Recibimos una solicitud para crear una nueva contraseña. Usa este enlace en los próximos ${env.PASSWORD_RESET_MINUTES} minutos:\n\n` +
      `${link}\n\nTu código es: ${token}\n\n` +
      'Si no fuiste tú, ignora este correo; tu contraseña no cambiará.\n\nInmobiliaria Zugar',
  });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const passwordHash = await hashPassword(password);
  await withTransaction(async (db) => {
    const id = await Tokens.consumePasswordReset(hashOpaqueToken(token), db);
    if (!id) throw new AppError(400, 'INVALID_RESET_TOKEN', 'El enlace no es válido o ya expiró. Solicita uno nuevo.');
    await Users.updatePassword(id, passwordHash, db);
    await Tokens.revokeAllForUser(id, db);
    await insertActivity({ userId: id, entity: 'auth', action: 'password_reset', description: 'Creó una nueva contraseña con el enlace de recuperación.' }, db);
  });
}
