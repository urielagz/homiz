import { pool, type Db } from '../config/database.js';

/** Datos del expediente del cliente que puede ver él mismo (nunca incluye al broker responsable). */
export interface ClientProfile {
  id: string;
  kind: 'cliente' | 'inquilino';
  name: string;
  email: string | null;
  phone: string | null;
  budget: string | null;
  has_pets: boolean;
  pets_count: number;
  occupants: number | null;
  property_id: string | null;
}

export async function findByUserId(userId: string, db: Db = pool): Promise<ClientProfile | null> {
  const { rows } = await db.query<ClientProfile>(
    `SELECT id, kind, name, email, phone, budget, has_pets, pets_count, occupants, property_id
       FROM clients WHERE user_id = $1 AND active`,
    [userId],
  );
  return rows[0] ?? null;
}

/**
 * Al registrarse, si la inmobiliaria ya tenía a la persona como cliente (mismo correo, sin cuenta),
 * se vincula ese expediente; si no, se crea uno nuevo.
 */
export async function linkOrCreateForUser(
  user: { id: string; name: string; email: string; phone: string | null },
  db: Db = pool,
): Promise<string> {
  const linked = await db.query<{ id: string }>(
    `UPDATE clients SET user_id = $1
      WHERE id = (SELECT id FROM clients WHERE lower(email) = lower($2) AND user_id IS NULL AND active ORDER BY created_at LIMIT 1)
      RETURNING id`,
    [user.id, user.email],
  );
  if (linked.rows[0]) return linked.rows[0].id;
  const created = await db.query<{ id: string }>(
    `INSERT INTO clients (user_id, kind, name, email, phone, follow_status)
     VALUES ($1, 'cliente', $2, $3, $4, 'Nuevo contacto') RETURNING id`,
    [user.id, user.name, user.email, user.phone],
  );
  return created.rows[0].id;
}
