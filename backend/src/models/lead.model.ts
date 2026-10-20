import { pool, type Db } from '../config/database.js';

export interface LeadRow {
  id: string;
  folio: string;
  reason: 'visita' | 'rentar' | 'comprar' | 'publicar' | 'otro';
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  property_id: string | null;
  property_code: string | null;
  property_name: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  payload: Record<string, unknown>;
  status: 'nuevo' | 'en_seguimiento' | 'cerrado';
  client_id: string | null;
  created_at: Date;
}

const SELECT = `
  SELECT l.id, l.folio, l.reason, l.name, l.email, l.phone, l.message, l.property_id, p.code AS property_code,
         p.name AS property_name, to_char(l.preferred_date, 'YYYY-MM-DD') AS preferred_date, l.preferred_time,
         l.payload, l.status, l.client_id, l.created_at
    FROM leads l LEFT JOIN properties p ON p.id = l.property_id`;

export async function insert(
  db: Db,
  l: { folio: string; reason: LeadRow['reason']; name: string; email: string; phone: string | null; message: string | null; propertyId: string | null; preferredDate: string | null; preferredTime: string | null; payload: Record<string, unknown>; clientId: string | null },
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO leads (folio, reason, name, email, phone, message, property_id, preferred_date, preferred_time, payload, client_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
    [l.folio, l.reason, l.name, l.email, l.phone, l.message, l.propertyId, l.preferredDate, l.preferredTime, JSON.stringify(l.payload), l.clientId],
  );
  return rows[0].id;
}

/** brokerId: solo solicitudes de sus casas y las que no tienen casa (publicar u otro motivo). */
export async function list(f: { brokerId?: string; status?: string; reason?: string; page: number; limit: number }): Promise<{ rows: LeadRow[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.brokerId) {
    params.push(f.brokerId);
    where.push(`(l.property_id IS NULL OR p.broker_id = $${params.length})`);
  }
  if (f.status) {
    params.push(f.status);
    where.push(`l.status = $${params.length}`);
  }
  if (f.reason) {
    params.push(f.reason);
    where.push(`l.reason = $${params.length}`);
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = await pool.query<{ n: string }>(`SELECT count(*) AS n FROM leads l LEFT JOIN properties p ON p.id = l.property_id ${w}`, params);
  const { rows } = await pool.query<LeadRow>(`${SELECT} ${w} ORDER BY l.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [
    ...params,
    f.limit,
    (f.page - 1) * f.limit,
  ]);
  return { rows, total: Number(total.rows[0].n) };
}

export async function findById(id: string): Promise<LeadRow | null> {
  const { rows } = await pool.query<LeadRow>(`${SELECT} WHERE l.id = $1`, [id]);
  return rows[0] ?? null;
}
