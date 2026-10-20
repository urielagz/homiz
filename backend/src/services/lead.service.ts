import { withTransaction, type Db } from '../config/database.js';
import { env } from '../config/env.js';
import * as Leads from '../models/lead.model.js';
import * as Properties from '../models/property.model.js';
import { insertActivity } from '../models/activity.model.js';
import { AppError } from '../middlewares/error-handler.js';
import { nextCode, nextFolio } from './codes.service.js';
import { notify, staffWithPermission } from './notification.service.js';

export interface LeadInput {
  reason: Leads.LeadRow['reason'];
  name: string;
  email: string;
  phone?: string | null;
  message?: string | null;
  propertySlug?: string;
  propertyCode?: string;
  preferredDate?: string;
  preferredTime?: string;
  payload?: Record<string, unknown>;
}

const REASON_TEXT: Record<Leads.LeadRow['reason'], string> = {
  visita: 'quiere visitar',
  rentar: 'quiere rentar',
  comprar: 'quiere comprar',
  publicar: 'quiere publicar su casa',
  otro: 'escribió por otro motivo',
};

/** Busca el expediente por correo o crea uno nuevo (sin cuenta de app). */
async function findOrCreateClient(db: Db, l: LeadInput, propertyId: string | null, brokerId: string | null): Promise<string> {
  const found = await db.query<{ id: string }>(`SELECT id FROM clients WHERE lower(email) = lower($1) AND active ORDER BY created_at LIMIT 1`, [l.email]);
  if (found.rows[0]) return found.rows[0].id;
  const p = l.payload ?? {};
  const str = (k: string) => (typeof p[k] === 'string' && p[k] ? String(p[k]) : null);
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO clients (kind, name, email, phone, nationality, occupation, operation, budget, has_pets, occupants, follow_status, property_id, broker_id)
     VALUES ('cliente', $1, $2, $3, $4, $5, $6, $7, $8, $9, 'Nuevo contacto', $10, $11) RETURNING id`,
    [
      l.name, l.email, l.phone ?? null, str('nacionalidad'), str('ocupacion'),
      l.reason === 'comprar' ? 'Compra' : 'Renta', str('presupuesto'), p.mascotas === 'si',
      Number(p.personas) || null, propertyId, brokerId,
    ],
  );
  return rows[0].id;
}

/**
 * Registra una solicitud del sitio (Contáctanos, «¿Te imaginas viviendo aquí?», bloque de contacto del inicio).
 * Una solicitud de visita con fecha y hora crea además la cita «por confirmar» para el broker de la casa.
 */
export async function createLead(l: LeadInput): Promise<{ folio: string; appointmentCode: string | null }> {
  const property = l.propertySlug ? await Properties.findBySlug(l.propertySlug) : l.propertyCode ? await Properties.findByCode(l.propertyCode) : null;
  if ((l.propertySlug || l.propertyCode) && !property) throw new AppError(404, 'NOT_FOUND', 'La casa indicada no existe.');
  if (l.reason === 'visita' && !property) throw new AppError(400, 'VALIDATION_ERROR', 'Indica la casa que quieres visitar.', { propertySlug: ['Indica la casa que quieres visitar.'] });

  return withTransaction(async (db) => {
    const folio = await nextFolio(db);
    const clientId = l.reason === 'publicar' || l.reason === 'otro' ? null : await findOrCreateClient(db, l, property?.id ?? null, property?.broker_id ?? null);
    const leadId = await Leads.insert(db, {
      folio, reason: l.reason, name: l.name, email: l.email, phone: l.phone ?? null, message: l.message ?? null,
      propertyId: property?.id ?? null, preferredDate: l.preferredDate ?? null, preferredTime: l.preferredTime ?? null,
      payload: l.payload ?? {}, clientId,
    });

    let appointmentCode: string | null = null;
    if (l.reason === 'visita' && property && clientId && l.preferredDate && l.preferredTime) {
      const code = await nextCode(db, 'appointments', 'CIT');
      await db.query('SAVEPOINT cita');
      try {
        await db.query(
          `INSERT INTO appointments (code, property_id, client_id, broker_id, scheduled_at, status, note, lead_id)
           VALUES ($1, $2, $3, $4, ($5::date + $6::time) AT TIME ZONE $7, 'por-confirmar', $8, $9)`,
          [code, property.id, clientId, property.broker_id, l.preferredDate, l.preferredTime, env.TZ_APP, l.message ?? null, leadId],
        );
        appointmentCode = code;
      } catch (err) {
        // Si el broker ya tiene una cita a esa hora, la solicitud se guarda igual y él propondrá otro horario.
        if ((err as { code?: string }).code !== '23505') throw err;
        await db.query('ROLLBACK TO SAVEPOINT cita');
      }
    }

    await insertActivity({
      propertyId: property?.id ?? null, entity: 'lead', entityId: leadId, action: 'create',
      description: `${l.name} ${REASON_TEXT[l.reason]}${property ? ` ${property.name}` : ''} (folio ${folio}).`,
    }, db);

    const recipients = property?.broker_id ? [property.broker_id] : await staffWithPermission('leads.manage', db);
    await notify(recipients, {
      type: l.reason === 'visita' ? 'appointment_requested' : 'lead_received',
      title: l.reason === 'visita' ? 'Nueva solicitud de visita' : 'Nueva solicitud del sitio',
      message: `${l.name} ${REASON_TEXT[l.reason]}${property ? ` ${property.name}` : ''}. Folio ${folio}.`,
      entity: 'lead',
      entityId: leadId,
    }, db);
    return { folio, appointmentCode };
  });
}
