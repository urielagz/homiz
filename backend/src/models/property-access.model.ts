import { pool, type Db } from '../config/database.js';

/* Consultas para verificar la pertenencia de un recurso a quien lo pide. */

export async function propertyBrokerId(propertyId: string, db: Db = pool): Promise<string | null | undefined> {
  const { rows } = await db.query<{ broker_id: string | null }>(
    'SELECT broker_id FROM properties WHERE id = $1 AND active',
    [propertyId],
  );
  return rows.length ? rows[0].broker_id : undefined; // undefined = la propiedad no existe
}

/** El cliente está vinculado a la propiedad si tiene contrato vigente en ella o es su propiedad registrada. */
export async function clientLinkedToProperty(clientId: string, propertyId: string, db: Db = pool): Promise<boolean> {
  const { rows } = await db.query(
    `SELECT 1 FROM contracts WHERE client_id = $1 AND property_id = $2 AND status = 'active'
     UNION ALL
     SELECT 1 FROM clients WHERE id = $1 AND property_id = $2 AND kind = 'inquilino' AND active
     LIMIT 1`,
    [clientId, propertyId],
  );
  return rows.length > 0;
}

export async function brokerPropertyIds(brokerId: string, db: Db = pool): Promise<string[]> {
  const { rows } = await db.query<{ id: string }>('SELECT id FROM properties WHERE broker_id = $1', [brokerId]);
  return rows.map((r) => r.id);
}
