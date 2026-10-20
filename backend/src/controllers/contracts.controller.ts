import type { RequestHandler } from 'express';
import { z } from 'zod';
import { pool } from '../config/database.js';
import { currentUser } from '../middlewares/authenticate.js';
import { AppError } from '../middlewares/error-handler.js';
import { dateField, money, pagination, paged, positiveMoney } from '../middlewares/validate.js';
import { assertPropertyAccess, propertyScope } from '../services/access.service.js';
import { createContract, finishContract } from '../services/contract.service.js';

export const listQueryDto = pagination.extend({
  propertyId: z.uuid().optional(),
  clientId: z.uuid().optional(),
  status: z.enum(['active', 'finished', 'cancelled']).optional(),
});
export const createDto = z
  .object({
    propertyId: z.uuid({ error: 'Elige la propiedad.' }),
    clientId: z.uuid({ error: 'Elige al cliente.' }),
    startDate: dateField,
    endDate: dateField,
    monthlyRent: positiveMoney,
    paymentDay: z.coerce.number().int().min(1, 'El día de pago va del 1 al 28.').max(28, 'El día de pago va del 1 al 28.'),
    deposit: money.nullable().optional(),
    documentId: z.uuid().nullable().optional(),
  })
  .refine((v) => v.endDate > v.startDate, { message: 'La fecha de fin debe ser posterior al inicio.', path: ['endDate'] });
export const finishDto = z.object({ endDate: dateField.optional(), reason: z.string().trim().max(300).optional() });

const SELECT = `
  SELECT ct.id, ct.property_id, p.code AS property_code, p.name AS property_name, ct.client_id, c.name AS client_name,
         to_char(ct.start_date, 'YYYY-MM-DD') AS start_date, to_char(ct.end_date, 'YYYY-MM-DD') AS end_date,
         ct.monthly_rent, ct.payment_day, ct.deposit, ct.status, ct.document_id, ct.created_at,
         (SELECT count(*)::int FROM promissory_notes n WHERE n.contract_id = ct.id AND n.status <> 'cancelled') AS notes_total,
         (SELECT count(*)::int FROM promissory_notes n WHERE n.contract_id = ct.id AND n.status = 'paid') AS notes_paid,
         (SELECT count(*)::int FROM promissory_notes n WHERE n.contract_id = ct.id AND n.status = 'overdue') AS notes_overdue
    FROM contracts ct JOIN properties p ON p.id = ct.property_id JOIN clients c ON c.id = ct.client_id`;

type Row = Record<string, unknown> & { id: string; property_id: string };
const present = (r: Row) => ({
  id: r.id, property: { id: r.property_id, code: r.property_code, name: r.property_name }, client: { id: r.client_id, name: r.client_name },
  startDate: r.start_date, endDate: r.end_date, monthlyRent: r.monthly_rent, paymentDay: r.payment_day, deposit: r.deposit,
  status: r.status, documentId: r.document_id, notes: { total: r.notes_total, paid: r.notes_paid, overdue: r.notes_overdue }, createdAt: r.created_at,
});

export const list: RequestHandler = async (_req, res) => {
  const q = res.locals.query as z.infer<typeof listQueryDto>;
  const scope = await propertyScope(currentUser(res));
  const params: unknown[] = [];
  const where: string[] = [];
  if (scope) where.push(`ct.property_id = ANY($${params.push(scope)}::uuid[])`);
  if (q.propertyId) where.push(`ct.property_id = $${params.push(q.propertyId)}`);
  if (q.clientId) where.push(`ct.client_id = $${params.push(q.clientId)}`);
  if (q.status) where.push(`ct.status = $${params.push(q.status)}`);
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = await pool.query<{ n: string }>(`SELECT count(*) AS n FROM contracts ct ${w}`, params);
  const { rows } = await pool.query<Row>(`${SELECT} ${w} ORDER BY ct.start_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, q.limit, (q.page - 1) * q.limit]);
  res.json(paged(rows.map(present), Number(total.rows[0].n), q));
};

async function findOne(id: string): Promise<Row> {
  const { rows } = await pool.query<Row>(`${SELECT} WHERE ct.id = $1`, [id]);
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'El contrato no existe.');
  return rows[0];
}

export const getOne: RequestHandler = async (_req, res) => {
  const row = await findOne((res.locals.params as { id: string }).id);
  await assertPropertyAccess(currentUser(res), row.property_id);
  res.json(present(row));
};

export const create: RequestHandler = async (_req, res) => {
  const id = await createContract(currentUser(res), res.locals.body as z.infer<typeof createDto>);
  res.status(201).json(present(await findOne(id)));
};

export const finish: RequestHandler = async (_req, res) => {
  const { id } = res.locals.params as { id: string };
  await finishContract(currentUser(res), id, res.locals.body as z.infer<typeof finishDto>);
  res.json(present(await findOne(id)));
};
