import { pool, withTransaction } from '../config/database.js';
import { AppError } from '../middlewares/error-handler.js';
import type { AuthUser } from '../middlewares/authenticate.js';
import { insertActivity } from '../models/activity.model.js';
import { assertPropertyAccess } from './access.service.js';
import { notify, userOfClient } from './notification.service.js';

export interface ContractInput {
  propertyId: string;
  clientId: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  paymentDay: number;
  deposit?: number | null;
  documentId?: string | null;
}

/**
 * Registra el contrato y genera un pagaré por mes: el primero es el día de pago del mes de inicio
 * (o del siguiente si ese día ya pasó) y el último, el que cae antes del fin del contrato.
 */
export async function createContract(user: AuthUser, c: ContractInput): Promise<string> {
  await assertPropertyAccess(user, c.propertyId);
  const prop = await pool.query<{ name: string; operation: string }>('SELECT name, operation FROM properties WHERE id = $1', [c.propertyId]);
  if (prop.rows[0].operation !== 'renta') throw new AppError(409, 'NOT_FOR_RENT', 'Solo se registran contratos de renta en casas en renta.');
  const client = await pool.query<{ name: string }>('SELECT name FROM clients WHERE id = $1 AND active', [c.clientId]);
  if (!client.rows[0]) throw new AppError(404, 'NOT_FOUND', 'El cliente no existe.');

  try {
    return await withTransaction(async (db) => {
      const { rows } = await db.query<{ id: string }>(
        `INSERT INTO contracts (property_id, client_id, start_date, end_date, monthly_rent, payment_day, deposit, document_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [c.propertyId, c.clientId, c.startDate, c.endDate, c.monthlyRent, c.paymentDay, c.deposit ?? null, c.documentId ?? null],
      );
      const id = rows[0].id;
      const notes = await db.query(
        `WITH base AS (
           SELECT make_date(EXTRACT(YEAR FROM $2::date)::int, EXTRACT(MONTH FROM $2::date)::int, $4::int) AS d
         ), first AS (
           SELECT CASE WHEN d >= $2::date THEN d ELSE (d + INTERVAL '1 month')::date END AS d FROM base
         )
         INSERT INTO promissory_notes (contract_id, number, amount, due_date)
         SELECT $1, n + 1, $5, (first.d + make_interval(months => n))::date
           FROM first, generate_series(0, 599) AS n
          WHERE (first.d + make_interval(months => n))::date <= $3::date`,
        [id, c.startDate, c.endDate, c.paymentDay, c.monthlyRent],
      );
      if (!notes.rowCount) throw new AppError(400, 'VALIDATION_ERROR', 'Con esas fechas no cae ningún día de pago. Revisa el inicio, el fin y el día de pago.');
      await db.query(`UPDATE properties SET status = 'rentada', visibility = 'pausada', updated_at = now() WHERE id = $1`, [c.propertyId]);
      await db.query(
        `UPDATE clients SET kind = 'inquilino', follow_status = 'Contrato vigente', property_id = $2, operation = 'Renta' WHERE id = $1`,
        [c.clientId, c.propertyId],
      );
      await db.query('INSERT INTO dossiers (property_id) VALUES ($1) ON CONFLICT (property_id) DO NOTHING', [c.propertyId]);
      await insertActivity({
        userId: user.id, propertyId: c.propertyId, entity: 'contract', entityId: id, action: 'create',
        description: `${user.name} registró el contrato de ${client.rows[0].name} en ${prop.rows[0].name} con ${notes.rowCount} pagarés.`,
        newValues: c,
      }, db);
      await notify([await userOfClient(c.clientId, db)], {
        type: 'contract_created', title: 'Tu contrato está listo', message: `Ya puedes consultar tu contrato y tus ${notes.rowCount} pagarés de ${prop.rows[0].name} en la app.`,
        entity: 'contract', entityId: id,
      }, db);
      return id;
    });
  } catch (err) {
    if ((err as { code?: string }).code === '23505') throw new AppError(409, 'ACTIVE_CONTRACT_EXISTS', 'Esta casa ya tiene un contrato vigente.');
    throw err;
  }
}

/** Finaliza el contrato. Los pagarés sin pagar posteriores a la fecha de término quedan cancelados (no se borran). */
export async function finishContract(user: AuthUser, id: string, data: { endDate?: string; reason?: string }): Promise<void> {
  const { rows } = await pool.query<{ property_id: string; client_id: string; status: string; client_name: string; property_name: string }>(
    `SELECT ct.property_id, ct.client_id, ct.status, c.name AS client_name, p.name AS property_name
       FROM contracts ct JOIN clients c ON c.id = ct.client_id JOIN properties p ON p.id = ct.property_id WHERE ct.id = $1`,
    [id],
  );
  const ct = rows[0];
  if (!ct) throw new AppError(404, 'NOT_FOUND', 'El contrato no existe.');
  await assertPropertyAccess(user, ct.property_id);
  if (ct.status !== 'active') throw new AppError(409, 'CONTRACT_NOT_ACTIVE', 'El contrato ya no está vigente.');
  const endDate = data.endDate ?? new Date().toISOString().slice(0, 10);

  await withTransaction(async (db) => {
    await db.query(`UPDATE contracts SET status = 'finished', end_date = LEAST(end_date, $2::date) WHERE id = $1`, [id, endDate]);
    const cancelled = await db.query(
      `UPDATE promissory_notes SET status = 'cancelled' WHERE contract_id = $1 AND status IN ('pending', 'overdue') AND due_date > $2::date`,
      [id, endDate],
    );
    await db.query(`UPDATE properties SET status = 'disponible', updated_at = now() WHERE id = $1`, [ct.property_id]);
    await db.query(`UPDATE clients SET follow_status = 'Contrato finalizado' WHERE id = $1`, [ct.client_id]);
    await insertActivity({
      userId: user.id, propertyId: ct.property_id, entity: 'contract', entityId: id, action: 'finish',
      description: `${user.name} finalizó el contrato de ${ct.client_name} en ${ct.property_name}${data.reason ? ` (${data.reason})` : ''}; ${cancelled.rowCount} pagarés quedaron cancelados.`,
    }, db);
  });
}
