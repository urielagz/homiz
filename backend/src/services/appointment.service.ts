import { pool, withTransaction } from '../config/database.js';
import { AppError } from '../middlewares/error-handler.js';
import type { AuthUser } from '../middlewares/authenticate.js';
import { insertActivity } from '../models/activity.model.js';
import { assertPropertyAccess, checkPropertyAccess, isAdmin } from './access.service.js';
import { nextCode } from './codes.service.js';
import { notify, userOfClient } from './notification.service.js';

export type ApptStatus = 'por-confirmar' | 'confirmada' | 'rechazada' | 'cancelada' | 'realizada';

export interface ApptRow {
  id: string;
  code: string;
  property_id: string;
  property_code: string;
  property_name: string;
  property_zone: string;
  property_address: string;
  photo_key: string | null;
  client_id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  client_user_id: string | null;
  broker_id: string | null;
  broker_name: string | null;
  broker_phone: string | null;
  scheduled_at: Date;
  duration_min: number;
  kind: string;
  status: ApptStatus;
  note: string | null;
  reason: string | null;
  proposed_at: Date | null;
  confirmed_by: string | null;
  created_at: Date;
}

const SELECT = `
  SELECT a.id, a.code, a.property_id, p.code AS property_code, p.name AS property_name, p.zone AS property_zone,
         p.address AS property_address,
         (SELECT storage_key FROM property_photos ph WHERE ph.property_id = p.id ORDER BY position LIMIT 1) AS photo_key,
         a.client_id, c.name AS client_name, c.email AS client_email, c.phone AS client_phone, c.user_id AS client_user_id,
         a.broker_id, b.name AS broker_name, b.phone AS broker_phone,
         a.scheduled_at, a.duration_min, a.kind, a.status, a.note, a.reason, a.proposed_at, a.confirmed_by, a.created_at
    FROM appointments a
    JOIN properties p ON p.id = a.property_id
    JOIN clients c ON c.id = a.client_id
    LEFT JOIN users b ON b.id = a.broker_id`;

export function present(a: ApptRow, user: AuthUser) {
  const base = {
    id: a.id,
    code: a.code,
    property: { id: a.property_id, code: a.property_code, name: a.property_name, zone: a.property_zone, address: a.property_address, photo: a.photo_key },
    scheduledAt: a.scheduled_at,
    durationMin: a.duration_min,
    kind: a.kind,
    status: a.status,
    note: a.note,
    reason: a.reason,
    createdAt: a.created_at,
  };
  if (user.type !== 'staff') return base;
  return {
    ...base,
    client: { id: a.client_id, name: a.client_name, email: a.client_email, phone: a.client_phone },
    broker: a.broker_id ? { id: a.broker_id, name: a.broker_name, phone: a.broker_phone } : null,
    confirmedBy: a.confirmed_by,
  };
}

/** Citas visibles: cliente = las suyas; broker = las que atiende; administrador = todas. */
export async function list(user: AuthUser, f: { status?: string[]; from?: string; to?: string; propertyId?: string; clientId?: string; page: number; limit: number }) {
  const params: unknown[] = [];
  const where: string[] = [];
  if (user.type === 'client') where.push(`a.client_id = $${params.push(user.clientId ?? '00000000-0000-0000-0000-000000000000')}`);
  else if (!isAdmin(user)) where.push(`a.broker_id = $${params.push(user.id)}`);
  if (f.status?.length) where.push(`a.status::text = ANY($${params.push(f.status)}::text[])`);
  if (f.from) where.push(`a.scheduled_at >= $${params.push(f.from)}::date`);
  if (f.to) where.push(`a.scheduled_at < ($${params.push(f.to)}::date + 1)`);
  if (f.propertyId) where.push(`a.property_id = $${params.push(f.propertyId)}`);
  if (f.clientId && user.type === 'staff') where.push(`a.client_id = $${params.push(f.clientId)}`);
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = await pool.query<{ n: string }>(`SELECT count(*) AS n FROM appointments a ${w}`, params);
  const { rows } = await pool.query<ApptRow>(`${SELECT} ${w} ORDER BY a.scheduled_at LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, f.limit, (f.page - 1) * f.limit]);
  return { rows, total: Number(total.rows[0].n) };
}

export async function findById(id: string): Promise<ApptRow | null> {
  const { rows } = await pool.query<ApptRow>(`${SELECT} WHERE a.id = $1`, [id]);
  return rows[0] ?? null;
}

/** Carga la cita verificando que quien la pide puede verla. */
export async function loadFor(user: AuthUser, id: string): Promise<ApptRow> {
  const a = await findById(id);
  const notFound = new AppError(404, 'NOT_FOUND', 'La cita no existe.');
  if (!a) throw notFound;
  if (user.type === 'client') {
    if (a.client_id !== user.clientId) throw notFound;
  } else if (!isAdmin(user) && a.broker_id !== user.id && (await checkPropertyAccess(user, a.property_id)) !== 'ok') {
    throw new AppError(403, 'NOT_OWNER', 'Esta cita no está asignada a ti.');
  }
  return a;
}

const when = (d: Date) =>
  d.toLocaleString('es-MX', { timeZone: 'America/Cancun', weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });

function conflict(err: unknown): never {
  if ((err as { code?: string }).code === '23505') throw new AppError(409, 'SCHEDULE_CONFLICT', 'Ese horario ya está ocupado. Elige otro.');
  throw err;
}

/** El cliente pide visita a una casa del catálogo (o a la que renta); el personal puede agendar por un cliente. */
export async function create(user: AuthUser, d: { propertyId: string; clientId?: string; scheduledAt: string; note?: string | null }): Promise<string> {
  if (new Date(d.scheduledAt).getTime() <= Date.now()) throw new AppError(400, 'VALIDATION_ERROR', 'Elige una fecha y hora futuras.', { scheduledAt: ['Elige una fecha y hora futuras.'] });
  const prop = await pool.query<{ name: string; broker_id: string | null; status: string; visibility: string; active: boolean }>(
    'SELECT name, broker_id, status, visibility, active FROM properties WHERE id = $1',
    [d.propertyId],
  );
  const p = prop.rows[0];
  if (!p || !p.active) throw new AppError(404, 'NOT_FOUND', 'La propiedad no existe.');

  let clientId: string;
  if (user.type === 'client') {
    if (!user.clientId) throw new AppError(409, 'NO_CLIENT_PROFILE', 'Tu cuenta aún no tiene expediente. Comunícate con la inmobiliaria.');
    const inCatalog = p.visibility === 'publicada' && ['disponible', 'reservada'].includes(p.status);
    if (!inCatalog && (await checkPropertyAccess(user, d.propertyId)) !== 'ok') throw new AppError(409, 'NOT_AVAILABLE', 'Esta casa no está disponible para visitas.');
    clientId = user.clientId;
  } else {
    await assertPropertyAccess(user, d.propertyId);
    if (!d.clientId) throw new AppError(400, 'VALIDATION_ERROR', 'Indica el cliente.', { clientId: ['Indica el cliente.'] });
    clientId = d.clientId;
  }

  try {
    return await withTransaction(async (db) => {
      const code = await nextCode(db, 'appointments', 'CIT');
      const { rows } = await db.query<{ id: string }>(
        `INSERT INTO appointments (code, property_id, client_id, broker_id, scheduled_at, status, note)
         VALUES ($1, $2, $3, $4, $5, 'por-confirmar', $6) RETURNING id`,
        [code, d.propertyId, clientId, p.broker_id, d.scheduledAt, d.note ?? null],
      );
      const id = rows[0].id;
      await insertActivity({ userId: user.id, propertyId: d.propertyId, entity: 'appointment', entityId: id, action: 'request', description: `${user.name} solicitó una visita a ${p.name} para el ${when(new Date(d.scheduledAt))}.` }, db);
      const target = user.type === 'client' ? p.broker_id : await userOfClient(clientId, db);
      await notify([target], {
        type: 'appointment_requested', title: 'Cita solicitada', message: `Visita a ${p.name} el ${when(new Date(d.scheduledAt))}. Pendiente de confirmar.`,
        entity: 'appointment', entityId: id,
      }, db);
      return id;
    });
  } catch (err) {
    conflict(err);
  }
}

type Action = 'confirm' | 'reject' | 'cancel' | 'complete' | 'reschedule';

const RULES: Record<Action, { from: ApptStatus[]; to: ApptStatus; staffOnly: boolean; verb: string; type: string; title: string }> = {
  confirm: { from: ['por-confirmar'], to: 'confirmada', staffOnly: true, verb: 'confirmó', type: 'appointment_confirmed', title: 'Cita confirmada' },
  reject: { from: ['por-confirmar'], to: 'rechazada', staffOnly: true, verb: 'rechazó', type: 'appointment_rejected', title: 'Cita rechazada' },
  cancel: { from: ['por-confirmar', 'confirmada'], to: 'cancelada', staffOnly: false, verb: 'canceló', type: 'appointment_cancelled', title: 'Cita cancelada' },
  complete: { from: ['confirmada'], to: 'realizada', staffOnly: true, verb: 'marcó como realizada', type: 'appointment_completed', title: 'Visita realizada' },
  reschedule: { from: ['por-confirmar', 'confirmada'], to: 'por-confirmar', staffOnly: false, verb: 'reprogramó', type: 'appointment_rescheduled', title: 'Cita reprogramada' },
};

/** Cambios de estado. Avisa a la otra parte: si actúa el cliente, al broker; si actúa el personal, al cliente. */
export async function transition(user: AuthUser, id: string, action: Action, d: { reason?: string; scheduledAt?: string } = {}): Promise<void> {
  const rule = RULES[action];
  const a = await loadFor(user, id);
  if (rule.staffOnly && user.type !== 'staff') throw new AppError(403, 'FORBIDDEN', 'No tienes permiso para realizar esta acción.');
  if (user.type === 'staff' && !user.permissions.has('appointments.manage')) throw new AppError(403, 'FORBIDDEN', 'No tienes permiso para realizar esta acción.', { missingPermissions: ['appointments.manage'] });
  if (!rule.from.includes(a.status)) {
    throw new AppError(409, 'INVALID_STATUS', `No se puede ${action === 'complete' ? 'marcar como realizada' : rule.verb.replace(/ó$/, 'ar')} una cita ${a.status.replace('-', ' ')}.`);
  }
  if (action === 'reject' && !d.reason) throw new AppError(400, 'VALIDATION_ERROR', 'Indica el motivo del rechazo.', { reason: ['Indica el motivo del rechazo.'] });
  if (action === 'reschedule') {
    if (!d.scheduledAt || new Date(d.scheduledAt).getTime() <= Date.now()) throw new AppError(400, 'VALIDATION_ERROR', 'Elige una fecha y hora futuras.', { scheduledAt: ['Elige una fecha y hora futuras.'] });
  }

  try {
    await withTransaction(async (db) => {
      const confirmedBy = action === 'confirm'
        ? `Confirmada por ${user.name.split(' ')[0]} · ${new Date().toLocaleString('es-MX', { timeZone: 'America/Cancun', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} h.`
        : null;
      await db.query(
        `UPDATE appointments
            SET status = $2::appointment_status, reason = COALESCE($3::text, reason),
                scheduled_at = COALESCE($4::timestamptz, scheduled_at),
                proposed_at = CASE WHEN $4::timestamptz IS NOT NULL THEN $4::timestamptz ELSE proposed_at END,
                confirmed_by = CASE WHEN $2::text = 'confirmada' THEN $5::text WHEN $2::text = 'por-confirmar' THEN NULL ELSE confirmed_by END
          WHERE id = $1`,
        [id, rule.to, d.reason ?? null, action === 'reschedule' ? d.scheduledAt : null, confirmedBy],
      );
      const newWhen = when(action === 'reschedule' ? new Date(d.scheduledAt!) : a.scheduled_at);
      await insertActivity({
        userId: user.id, propertyId: a.property_id, entity: 'appointment', entityId: id, action,
        description: `${user.name} ${rule.verb} la visita de ${a.client_name} a ${a.property_name} (${newWhen})${d.reason ? `: ${d.reason}` : ''}.`,
        oldValues: { status: a.status, scheduledAt: a.scheduled_at }, newValues: { status: rule.to, scheduledAt: d.scheduledAt ?? a.scheduled_at },
      }, db);
      const target = user.type === 'client' ? a.broker_id : a.client_user_id;
      const msg = {
        confirm: `Tu visita a ${a.property_name} es el ${newWhen}.`,
        reject: `No pudimos confirmar tu visita a ${a.property_name}${d.reason ? `: ${d.reason}` : '.'}`,
        cancel: `La visita a ${a.property_name} del ${newWhen} se canceló${d.reason ? `: ${d.reason}` : '.'}`,
        complete: `Gracias por visitar ${a.property_name}.`,
        reschedule: `La visita a ${a.property_name} cambió al ${newWhen}. Queda pendiente de confirmar.`,
      }[action];
      await notify([target], { type: rule.type, title: rule.title, message: msg, entity: 'appointment', entityId: id }, db);
    });
  } catch (err) {
    conflict(err);
  }
}

/* ---------- Chat de la cita ---------- */
export async function messages(user: AuthUser, id: string) {
  await loadFor(user, id);
  const { rows } = await pool.query<{ id: string; sender_id: string; sender_name: string; sender_type: string; body: string; created_at: Date }>(
    `SELECT m.id, m.sender_id, u.name AS sender_name, u.type AS sender_type, m.body, m.created_at
       FROM appointment_messages m JOIN users u ON u.id = m.sender_id
      WHERE m.appointment_id = $1 ORDER BY m.created_at`,
    [id],
  );
  // Al cliente el personal se le presenta como «Zugar» (no ve quién es el broker).
  return rows.map((m) => ({
    id: m.id,
    mine: m.sender_id === user.id,
    sender: m.sender_type === 'staff' && user.type === 'client' ? 'Zugar' : m.sender_name,
    fromStaff: m.sender_type === 'staff',
    body: m.body,
    createdAt: m.created_at,
  }));
}

export async function sendMessage(user: AuthUser, id: string, body: string): Promise<void> {
  const a = await loadFor(user, id);
  if (a.status === 'cancelada' || a.status === 'rechazada') throw new AppError(409, 'INVALID_STATUS', 'Esta cita ya no admite mensajes.');
  await pool.query('INSERT INTO appointment_messages (appointment_id, sender_id, body) VALUES ($1, $2, $3)', [id, user.id, body]);
  const target = user.type === 'client' ? a.broker_id : a.client_user_id;
  await notify([target], {
    type: 'appointment_message', title: user.type === 'client' ? `Mensaje de ${a.client_name}` : 'Nuevo mensaje de Zugar',
    message: body.length > 120 ? `${body.slice(0, 117)}…` : body, entity: 'appointment', entityId: id,
  });
}
