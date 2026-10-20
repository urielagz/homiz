import type { RequestHandler } from 'express';
import { z } from 'zod';
import { pool } from '../config/database.js';
import { insertActivity } from '../models/activity.model.js';
import { currentUser, type AuthUser } from '../middlewares/authenticate.js';
import { AppError } from '../middlewares/error-handler.js';
import { emailField, money, nameField, pagination, paged } from '../middlewares/validate.js';
import { assertPropertyAccess, isAdmin } from '../services/access.service.js';

const FOLLOW = ['Nuevo contacto', 'En seguimiento', 'Visita confirmada', 'Por confirmar', 'Reservada', 'Contrato vigente', 'Contrato finalizado'] as const;

export const listQueryDto = pagination.extend({
  q: z.string().trim().max(80).optional(),
  kind: z.enum(['cliente', 'inquilino']).optional(),
  followStatus: z.enum(FOLLOW).optional(),
  propertyId: z.uuid().optional(),
});

const fields = {
  name: nameField,
  email: emailField.nullable(),
  phone: z.string().trim().max(30).nullable(),
  address: z.string().trim().max(200).nullable(),
  kind: z.enum(['cliente', 'inquilino']),
  label: z.string().trim().max(40).nullable(),
  nationality: z.string().trim().max(60).nullable(),
  occupation: z.string().trim().max(80).nullable(),
  operation: z.enum(['Renta', 'Compra']).nullable(),
  budget: z.string().trim().max(60).nullable(),
  budgetAmount: money.nullable(),
  needs: z.string().trim().max(200).nullable(),
  hasPets: z.boolean(),
  petsCount: z.coerce.number().int().min(0).max(20),
  occupants: z.coerce.number().int().min(1).max(30).nullable(),
  followStatus: z.enum(FOLLOW),
  propertyId: z.uuid().nullable(),
  brokerId: z.uuid().nullable(),
};
export const createDto = z.object({
  ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.optional()])),
  name: fields.name,
}) as z.ZodType<Partial<Record<keyof typeof fields, unknown>> & { name: string }>;
export const updateDto = z
  .object(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.optional()])))
  .refine((v) => Object.keys(v).length > 0, 'Envía al menos un dato para actualizar.');

const COLS: Record<keyof typeof fields, string> = {
  name: 'name', email: 'email', phone: 'phone', address: 'address', kind: 'kind', label: 'label', nationality: 'nationality',
  occupation: 'occupation', operation: 'operation', budget: 'budget', budgetAmount: 'budget_amount', needs: 'needs',
  hasPets: 'has_pets', petsCount: 'pets_count', occupants: 'occupants', followStatus: 'follow_status', propertyId: 'property_id', brokerId: 'broker_id',
};

const SELECT = `
  SELECT c.*, p.code AS property_code, p.name AS property_name, b.name AS broker_name, (c.user_id IS NOT NULL) AS has_account
    FROM clients c
    LEFT JOIN properties p ON p.id = c.property_id
    LEFT JOIN users b ON b.id = c.broker_id`;

type Row = Record<string, unknown> & { id: string; broker_id: string | null; property_id: string | null };

const present = (c: Row) => ({
  id: c.id, kind: c.kind, label: c.label, name: c.name, email: c.email, phone: c.phone, address: c.address,
  nationality: c.nationality, occupation: c.occupation, operation: c.operation, budget: c.budget, budgetAmount: c.budget_amount,
  needs: c.needs, hasPets: c.has_pets, petsCount: c.pets_count, occupants: c.occupants, followStatus: c.follow_status,
  property: c.property_id ? { id: c.property_id, code: c.property_code, name: c.property_name } : null,
  broker: c.broker_id ? { id: c.broker_id, name: c.broker_name } : null,
  hasAccount: c.has_account, createdAt: c.created_at,
});

/** El broker ve los clientes que tiene asignados o que están ligados a sus casas. */
function scopeSql(user: AuthUser, params: unknown[]): string {
  if (isAdmin(user)) return '';
  params.push(user.id);
  return `AND (c.broker_id = $${params.length} OR c.property_id IN (SELECT id FROM properties WHERE broker_id = $${params.length}))`;
}

async function findScoped(user: AuthUser, id: string): Promise<Row> {
  const params: unknown[] = [id];
  const { rows } = await pool.query<Row>(`${SELECT} WHERE c.id = $1 AND c.active ${scopeSql(user, params)}`, params);
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'El cliente no existe o no lo tienes asignado.');
  return rows[0];
}

export const list: RequestHandler = async (_req, res) => {
  const user = currentUser(res);
  const q = res.locals.query as z.infer<typeof listQueryDto>;
  const params: unknown[] = [];
  let where = `WHERE c.active ${scopeSql(user, params)}`;
  if (q.q) where += ` AND (c.name ILIKE $${params.push(`%${q.q}%`)} OR c.email ILIKE $${params.length} OR c.phone ILIKE $${params.length})`;
  if (q.kind) where += ` AND c.kind = $${params.push(q.kind)}`;
  if (q.followStatus) where += ` AND c.follow_status = $${params.push(q.followStatus)}`;
  if (q.propertyId) where += ` AND c.property_id = $${params.push(q.propertyId)}`;
  const total = await pool.query<{ n: string }>(`SELECT count(*) AS n FROM clients c ${where}`, params);
  const { rows } = await pool.query<Row>(`${SELECT} ${where} ORDER BY c.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, q.limit, (q.page - 1) * q.limit]);
  res.json(paged(rows.map(present), Number(total.rows[0].n), q));
};

export const getOne: RequestHandler = async (_req, res) => {
  res.json(present(await findScoped(currentUser(res), (res.locals.params as { id: string }).id)));
};

async function checkLinks(user: AuthUser, d: Record<string, unknown>) {
  if (d.propertyId) await assertPropertyAccess(user, d.propertyId as string);
  if (d.brokerId && !isAdmin(user) && d.brokerId !== user.id) throw new AppError(403, 'FORBIDDEN', 'Solo un administrador puede asignar el cliente a otro broker.');
}

export const create: RequestHandler = async (_req, res) => {
  const user = currentUser(res);
  const d = res.locals.body as Record<string, unknown>;
  await checkLinks(user, d);
  if (!isAdmin(user)) d.brokerId = user.id;
  const cols: string[] = [];
  const vals: unknown[] = [];
  for (const [k, col] of Object.entries(COLS)) if (d[k] !== undefined) { cols.push(col); vals.push(d[k]); }
  const { rows } = await pool.query<{ id: string }>(`INSERT INTO clients (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`, vals);
  await insertActivity({ userId: user.id, propertyId: (d.propertyId as string) ?? null, entity: 'client', entityId: rows[0].id, action: 'create', description: `${user.name} registró a ${d.name as string}.` });
  res.status(201).json(present(await findScoped(user, rows[0].id)));
};

export const update: RequestHandler = async (_req, res) => {
  const user = currentUser(res);
  const { id } = res.locals.params as { id: string };
  const before = await findScoped(user, id);
  const d = res.locals.body as Record<string, unknown>;
  await checkLinks(user, d);
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, col] of Object.entries(COLS)) if (d[k] !== undefined) { vals.push(d[k]); sets.push(`${col} = $${vals.length}`); }
  vals.push(id);
  await pool.query(`UPDATE clients SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals);
  await insertActivity({ userId: user.id, propertyId: before.property_id, entity: 'client', entityId: id, action: 'update', description: `${user.name} actualizó el expediente de ${before.name as string}.`, newValues: d });
  res.json(present(await findScoped(user, id)));
};

/** Baja lógica. No se permite si tiene un contrato vigente. */
export const remove: RequestHandler = async (_req, res) => {
  const user = currentUser(res);
  const { id } = res.locals.params as { id: string };
  const c = await findScoped(user, id);
  const { rowCount } = await pool.query(`SELECT 1 FROM contracts WHERE client_id = $1 AND status = 'active'`, [id]);
  if (rowCount) throw new AppError(409, 'HAS_ACTIVE_CONTRACT', 'El cliente tiene un contrato vigente. Finalízalo antes de darlo de baja.');
  const cancelled = await pool.query(
    `UPDATE appointments SET status = 'cancelada', reason = 'El cliente se dio de baja.'
      WHERE client_id = $1 AND status IN ('por-confirmar', 'confirmada') AND scheduled_at > now()`,
    [id],
  );
  await pool.query('UPDATE clients SET active = FALSE WHERE id = $1', [id]);
  await insertActivity({ userId: user.id, propertyId: c.property_id, entity: 'client', entityId: id, action: 'delete', description: `${user.name} dio de baja el expediente de ${c.name as string}.` });
  res.json({ message: 'El expediente se dio de baja. Su historial se conserva.', appointmentsCancelled: cancelled.rowCount ?? 0 });
};
