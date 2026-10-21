import type { RequestHandler } from 'express';
import { z } from 'zod';
import * as Users from '../models/user.model.js';
import * as Clients from '../models/client.model.js';
import { insertActivity } from '../models/activity.model.js';
import { toPublicUser } from '../services/auth.service.js';
import { currentUser } from '../middlewares/authenticate.js';
import { AppError } from '../middlewares/error-handler.js';
import { nameField, phoneField } from '../middlewares/validate.js';

export const updateMeDto = z
  .object({
    name: nameField.optional(),
    phone: phoneField.nullable().optional(),
    birthDate: z.iso
      .date({ error: 'Usa el formato AAAA-MM-DD.' })
      .refine((d) => d <= new Date().toISOString().slice(0, 10), 'La fecha de nacimiento no puede ser futura.')
      .nullable()
      .optional(),
    // Solo clientes: datos de su expediente («Mis datos» en la cita).
    client: z
      .object({
        budgetAmount: z.number({ error: 'Escribe el presupuesto en números.' }).nonnegative().max(100_000_000).nullable().optional(),
        hasPets: z.boolean().optional(),
        petsCount: z.number().int().min(0).max(20).optional(),
        occupants: z.number().int().min(1, 'Indica al menos 1 inquilino.').max(30).nullable().optional(),
      })
      .refine((v) => Object.keys(v).length > 0, 'Envía al menos un dato del expediente.')
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Envía al menos un dato para actualizar.');

/** Perfil propio. Al cliente se le agrega su expediente básico (sin datos del broker responsable). */
async function profile(userId: string) {
  const row = await Users.findById(userId);
  if (!row) throw new AppError(404, 'NOT_FOUND', 'La cuenta no existe.');
  const user = await toPublicUser(row);
  if (row.type !== 'client') return { ...user, client: null };
  const c = await Clients.findByUserId(row.id);
  return {
    ...user,
    client: c && {
      id: c.id,
      kind: c.kind,
      budget: c.budget,
      budgetAmount: c.budget_amount,
      hasPets: c.has_pets,
      petsCount: c.pets_count,
      occupants: c.occupants,
      propertyId: c.property_id,
    },
  };
}

export const getMe: RequestHandler = async (_req, res) => {
  res.json(await profile(currentUser(res).id));
};

export const updateMe: RequestHandler = async (_req, res) => {
  const user = currentUser(res);
  const data = res.locals.body as z.infer<typeof updateMeDto>;
  const before = await Users.findById(user.id);
  const { client, ...personal } = data;
  if (client && user.type !== 'client') throw new AppError(400, 'VALIDATION_ERROR', 'Solo los clientes tienen expediente.', { client: ['Solo los clientes tienen expediente.'] });
  if (Object.keys(personal).length) await Users.updateProfile(user.id, personal);
  if (client) await Clients.updateOwn(user.id, client);
  await insertActivity({
    userId: user.id,
    entity: 'user',
    entityId: user.id,
    action: 'update_profile',
    description: 'Actualizó sus datos personales.',
    oldValues: before && { name: before.name, phone: before.phone, birthDate: before.birth_date },
    newValues: data,
  });
  res.json(await profile(user.id));
};
