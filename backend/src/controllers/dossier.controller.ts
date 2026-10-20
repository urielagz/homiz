import type { RequestHandler } from 'express';
import { pool } from '../config/database.js';
import { currentUser } from '../middlewares/authenticate.js';
import { AppError } from '../middlewares/error-handler.js';
import { assertPropertyAccess } from '../services/access.service.js';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const shortDate = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

/**
 * GET /properties/:id/dossier — expediente digital.
 * Personal (dossier.read): todo, incluidos documentos internos, gastos e historial.
 * Cliente vinculado: vista restringida (contrato, documentos visibles, pagos, recibos y mantenimiento) sin broker ni gastos.
 */
export const getDossier: RequestHandler = async (_req, res) => {
  const user = currentUser(res);
  const { id } = res.locals.params as { id: string };
  if (user.type === 'staff' && !user.permissions.has('dossier.read')) throw new AppError(403, 'FORBIDDEN', 'No tienes permiso para consultar el expediente.', { missingPermissions: ['dossier.read'] });
  await assertPropertyAccess(user, id);
  const isClient = user.type === 'client';
  await pool.query('INSERT INTO dossiers (property_id) VALUES ($1) ON CONFLICT (property_id) DO NOTHING', [id]);

  const property = (await pool.query(
    `SELECT p.id, p.code, p.name, p.zone, p.address, p.city, p.status, p.rec, p.banos, p.m2, p.operation,
            (SELECT array_agg(name ORDER BY position) FROM property_amenities WHERE property_id = p.id) AS amenities,
            (SELECT storage_key FROM property_photos WHERE property_id = p.id ORDER BY position LIMIT 1) AS photo,
            b.name AS broker_name, b.phone AS broker_phone
       FROM properties p LEFT JOIN users b ON b.id = p.broker_id WHERE p.id = $1`,
    [id],
  )).rows[0];

  const contract = (await pool.query(
    `SELECT ct.id, to_char(ct.start_date, 'YYYY-MM-DD') AS "startDate", to_char(ct.end_date, 'YYYY-MM-DD') AS "endDate",
            ct.monthly_rent AS "monthlyRent", ct.payment_day AS "paymentDay", ct.deposit, ct.status, c.id AS client_id, c.name AS client_name,
            c.phone AS client_phone, c.email AS client_email
       FROM contracts ct JOIN clients c ON c.id = ct.client_id
      WHERE ct.property_id = $1 ${isClient ? 'AND ct.client_id = $2' : ''} ORDER BY (ct.status = 'active') DESC, ct.start_date DESC LIMIT 1`,
    isClient ? [id, user.clientId] : [id],
  )).rows[0] ?? null;

  const documents = (await pool.query(
    `SELECT id, type, name, description, mime, size, visible_to_client AS "visibleToClient", created_at AS "createdAt"
       FROM documents WHERE property_id = $1 AND promissory_note_id IS NULL ${isClient ? 'AND visible_to_client' : ''} ORDER BY created_at`,
    [id],
  )).rows.map((d) => (isClient ? { ...d, visibleToClient: undefined } : d));

  const notes = contract
    ? (await pool.query(
        `SELECT count(*) FILTER (WHERE status <> 'cancelled')::int AS total, count(*) FILTER (WHERE status = 'paid')::int AS paid,
                count(*) FILTER (WHERE status IN ('pending','overdue'))::int AS remaining, count(*) FILTER (WHERE status = 'overdue')::int AS overdue,
                COALESCE(sum(amount) FILTER (WHERE status IN ('pending','overdue')), 0) AS "remainingAmount",
                to_char(min(due_date) FILTER (WHERE status IN ('pending','overdue')), 'YYYY-MM-DD') AS "nextDue"
           FROM promissory_notes WHERE contract_id = $1`,
        [contract.id],
      )).rows[0]
    : null;

  const receipts = (await pool.query(
    `SELECT r.id, r.kind, r.concept, r.amount, to_char(r.due_date, 'YYYY-MM-DD') AS "dueDate", r.status FROM receipts r
      WHERE r.property_id = $1 ORDER BY r.due_date DESC NULLS LAST LIMIT 12`,
    [id],
  )).rows;

  const maintenance = (await pool.query(
    `SELECT id, title, category, priority, status, created_at AS "createdAt", closed_at AS "closedAt" FROM maintenance_reports
      WHERE property_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [id],
  )).rows;

  /* Secciones listas para la pestaña «Expediente» de la app. */
  const byType = (...types: string[]) => documents.filter((d) => types.includes(d.type));
  const sections = [
    contract && { key: 'contract', title: 'Contrato de renta', subtitle: contract.status === 'active' ? `Vigente hasta ${shortDate(contract.endDate)}` : `Finalizó el ${shortDate(contract.endDate)}`, documentIds: byType('contract').map((d) => d.id) },
    byType('deposit').length && { key: 'deposit', title: 'Depósito en garantía', subtitle: byType('deposit')[0].description ?? 'Comprobante', documentIds: byType('deposit').map((d) => d.id) },
    byType('delivery_sheet').length && { key: 'delivery_sheet', title: 'Ficha de entrega', subtitle: byType('delivery_sheet')[0].description ?? 'Estado de la casa al entregarla', documentIds: byType('delivery_sheet').map((d) => d.id) },
    byType('rules', 'annex', 'other', 'photo').length && { key: 'documents', title: 'Documentos', subtitle: `Reglamento y anexos - ${byType('rules', 'annex', 'other', 'photo').length} archivos`, documentIds: byType('rules', 'annex', 'other', 'photo').map((d) => d.id) },
  ].filter(Boolean);

  const base = {
    property: { id: property.id, code: property.code, name: property.name, zone: property.zone, address: property.address, city: property.city, rec: property.rec, banos: property.banos, m2: property.m2, amenities: property.amenities ?? [], photo: property.photo },
    contract: contract && { id: contract.id, startDate: contract.startDate, endDate: contract.endDate, monthlyRent: contract.monthlyRent, paymentDay: contract.paymentDay, deposit: contract.deposit, status: contract.status },
    sections,
    documents,
    payments: notes,
    receipts,
    maintenance,
  };
  if (isClient) return void res.json(base);

  const expenses = (await pool.query(
    `SELECT COALESCE(sum(amount), 0) AS total, COALESCE(sum(amount) FILTER (WHERE status = 'pending'), 0) AS pending,
            to_char(min(next_maintenance_date) FILTER (WHERE next_maintenance_date >= CURRENT_DATE), 'YYYY-MM-DD') AS "nextMaintenance"
       FROM expenses WHERE property_id = $1`,
    [id],
  )).rows[0];
  const activity = (await pool.query(
    `SELECT a.action, a.description, a.created_at AS "createdAt", u.name AS "user" FROM activity_log a LEFT JOIN users u ON u.id = a.user_id
      WHERE a.property_id = $1 ORDER BY a.created_at DESC LIMIT 20`,
    [id],
  )).rows;
  res.json({
    ...base,
    property: { ...base.property, status: property.status, operation: property.operation, broker: { name: property.broker_name, phone: property.broker_phone } },
    tenant: contract && { id: contract.client_id, name: contract.client_name, phone: contract.client_phone, email: contract.client_email },
    expenses,
    activity,
  });
};
