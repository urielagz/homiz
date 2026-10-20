import type { RequestHandler } from 'express';
import { pool } from '../config/database.js';
import { currentUser, type AuthUser } from '../middlewares/authenticate.js';
import { propertyScope } from '../services/access.service.js';

/* GET /dashboard — resumen según el perfil. */

async function clientDashboard(user: AuthUser) {
  const clientId = user.clientId ?? '00000000-0000-0000-0000-000000000000';
  const nextPayment = (await pool.query(
    `SELECT n.id, n.number, n.amount, to_char(n.due_date, 'YYYY-MM-DD') AS "dueDate", n.status
       FROM promissory_notes n JOIN contracts ct ON ct.id = n.contract_id
      WHERE ct.client_id = $1 AND n.status IN ('pending', 'overdue') ORDER BY n.due_date LIMIT 1`,
    [clientId],
  )).rows[0] ?? null;
  const nextAppointment = (await pool.query(
    `SELECT a.id, a.code, p.name AS "propertyName", a.scheduled_at AS "scheduledAt", a.status
       FROM appointments a JOIN properties p ON p.id = a.property_id
      WHERE a.client_id = $1 AND a.status IN ('por-confirmar', 'confirmada') AND a.scheduled_at > now() ORDER BY a.scheduled_at LIMIT 1`,
    [clientId],
  )).rows[0] ?? null;
  const reports = (await pool.query(
    `SELECT r.id, r.title, r.status, r.created_at AS "createdAt", count(*) OVER () AS total
       FROM maintenance_reports r
      WHERE r.property_id IN (SELECT property_id FROM contracts WHERE client_id = $1 AND status = 'active')
        AND r.status NOT IN ('resolved', 'cancelled')
      ORDER BY r.created_at DESC LIMIT 1`,
    [clientId],
  )).rows[0];
  const property = (await pool.query(
    `SELECT p.id, p.name, p.zone FROM contracts ct JOIN properties p ON p.id = ct.property_id WHERE ct.client_id = $1 AND ct.status = 'active' LIMIT 1`,
    [clientId],
  )).rows[0] ?? null;
  const unread = await pool.query<{ n: string }>('SELECT count(*) AS n FROM notifications WHERE user_id = $1 AND NOT read', [user.id]);
  return {
    profile: 'client',
    property,
    nextPayment,
    nextAppointment,
    openReports: { count: Number(reports?.total ?? 0), latest: reports ? { id: reports.id, title: reports.title, status: reports.status, createdAt: reports.createdAt } : null },
    unreadNotifications: Number(unread.rows[0].n),
  };
}

async function staffDashboard(user: AuthUser) {
  const scope = await propertyScope(user); // null = administrador (todo)
  const p = scope ? [scope] : [];
  const inScope = (col: string) => (scope ? `${col} = ANY($1::uuid[])` : 'TRUE');
  const one = async (sql: string) => Number((await pool.query<{ n: string }>(sql, p)).rows[0].n);

  const counts = {
    appointmentsToConfirm: await one(`SELECT count(*) AS n FROM appointments WHERE status = 'por-confirmar' AND scheduled_at > now() AND ${inScope('property_id')}`),
    appointmentsToday: await one(`SELECT count(*) AS n FROM appointments WHERE status = 'confirmada' AND (scheduled_at AT TIME ZONE 'America/Cancun')::date = (now() AT TIME ZONE 'America/Cancun')::date AND ${inScope('property_id')}`),
    overdueNotes: await one(`SELECT count(*) AS n FROM promissory_notes n JOIN contracts ct ON ct.id = n.contract_id WHERE n.status = 'overdue' AND ${inScope('ct.property_id')}`),
    upcomingNotes: await one(`SELECT count(*) AS n FROM promissory_notes n JOIN contracts ct ON ct.id = n.contract_id WHERE n.status = 'pending' AND n.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7 AND ${inScope('ct.property_id')}`),
    newReports: await one(`SELECT count(*) AS n FROM maintenance_reports WHERE status = 'reported' AND ${inScope('property_id')}`),
    openReports: await one(`SELECT count(*) AS n FROM maintenance_reports WHERE status NOT IN ('resolved', 'cancelled') AND ${inScope('property_id')}`),
    overdueReceipts: await one(`SELECT count(*) AS n FROM receipts WHERE status = 'overdue' AND ${inScope('property_id')}`),
    pendingExpenses: await one(`SELECT count(*) AS n FROM expenses WHERE status = 'pending' AND ${inScope('property_id')}`),
    upcomingMaintenance: await one(`SELECT count(*) AS n FROM expenses WHERE next_maintenance_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 14 AND ${inScope('property_id')}`),
    newLeads: await one(`SELECT count(*) AS n FROM leads WHERE status = 'nuevo' AND (property_id IS NULL OR ${inScope('property_id')})`),
  };
  const pendingAppointments = (await pool.query(
    `SELECT a.id, a.code, c.name AS "clientName", p.name AS "propertyName", a.scheduled_at AS "scheduledAt"
       FROM appointments a JOIN clients c ON c.id = a.client_id JOIN properties p ON p.id = a.property_id
      WHERE a.status = 'por-confirmar' AND a.scheduled_at > now() AND ${inScope('a.property_id')} ORDER BY a.scheduled_at LIMIT 5`,
    p,
  )).rows;
  const overdue = (await pool.query(
    `SELECT n.id, n.number, n.amount, to_char(n.due_date, 'YYYY-MM-DD') AS "dueDate", c.name AS "clientName", pr.name AS "propertyName"
       FROM promissory_notes n JOIN contracts ct ON ct.id = n.contract_id JOIN clients c ON c.id = ct.client_id JOIN properties pr ON pr.id = ct.property_id
      WHERE n.status = 'overdue' AND ${inScope('ct.property_id')} ORDER BY n.due_date LIMIT 5`,
    p,
  )).rows;
  const reports = (await pool.query(
    `SELECT r.id, r.title, r.priority, r.status, p.name AS "propertyName", r.created_at AS "createdAt"
       FROM maintenance_reports r JOIN properties p ON p.id = r.property_id
      WHERE r.status = 'reported' AND ${inScope('r.property_id')} ORDER BY r.created_at DESC LIMIT 5`,
    p,
  )).rows;
  return { profile: 'staff', roles: user.roles, counts, pendingAppointments, overdueNotes: overdue, newReports: reports };
}

export const getDashboard: RequestHandler = async (_req, res) => {
  const user = currentUser(res);
  res.json(user.type === 'client' ? await clientDashboard(user) : await staffDashboard(user));
};
