import type { RequestHandler } from 'express';
import { z } from 'zod';
import { pool } from '../config/database.js';
import * as Leads from '../models/lead.model.js';
import { insertActivity } from '../models/activity.model.js';
import { currentUser } from '../middlewares/authenticate.js';
import { AppError } from '../middlewares/error-handler.js';
import { pagination, paged } from '../middlewares/validate.js';
import { isAdmin } from '../services/access.service.js';

export const listQueryDto = pagination.extend({
  status: z.enum(['nuevo', 'en_seguimiento', 'cerrado']).optional(),
  reason: z.enum(['visita', 'rentar', 'comprar', 'publicar', 'otro']).optional(),
});
export const statusDto = z.object({ status: z.enum(['nuevo', 'en_seguimiento', 'cerrado'], { error: 'Estado no válido.' }) });

const present = (l: Leads.LeadRow) => ({
  id: l.id,
  folio: l.folio,
  reason: l.reason,
  name: l.name,
  email: l.email,
  phone: l.phone,
  message: l.message,
  property: l.property_id ? { id: l.property_id, code: l.property_code, name: l.property_name } : null,
  preferredDate: l.preferred_date,
  preferredTime: l.preferred_time,
  payload: l.payload,
  status: l.status,
  clientId: l.client_id,
  createdAt: l.created_at,
});

/** GET /leads — administrador: todas; broker: las de sus casas y las que no tienen casa. */
export const list: RequestHandler = async (_req, res) => {
  const user = currentUser(res);
  const q = res.locals.query as z.infer<typeof listQueryDto>;
  const { rows, total } = await Leads.list({ ...q, brokerId: isAdmin(user) ? undefined : user.id });
  res.json(paged(rows.map(present), total, q));
};

export const updateStatus: RequestHandler = async (_req, res) => {
  const user = currentUser(res);
  const { id } = res.locals.params as { id: string };
  const lead = await Leads.findById(id);
  if (!lead) throw new AppError(404, 'NOT_FOUND', 'La solicitud no existe.');
  if (!isAdmin(user) && lead.property_id) {
    const { rows } = await pool.query('SELECT broker_id FROM properties WHERE id = $1', [lead.property_id]);
    if (rows[0]?.broker_id !== user.id) throw new AppError(403, 'NOT_OWNER', 'Esta solicitud es de una casa que no tienes asignada.');
  }
  const { status } = res.locals.body as z.infer<typeof statusDto>;
  await pool.query('UPDATE leads SET status = $2 WHERE id = $1', [id, status]);
  await insertActivity({ userId: user.id, propertyId: lead.property_id, entity: 'lead', entityId: id, action: 'status', description: `${user.name} marcó la solicitud ${lead.folio} como ${status.replace('_', ' ')}.`, oldValues: { status: lead.status }, newValues: { status } });
  res.json(present((await Leads.findById(id))!));
};
