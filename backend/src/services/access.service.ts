import type { AuthUser } from '../middlewares/authenticate.js';
import { AppError } from '../middlewares/error-handler.js';
import * as Access from '../models/property-access.model.js';

/*
 * Pertenencia de recursos. Regla general:
 * - Administrador: acceso a todo (sus permisos se validan aparte con requirePermission).
 * - Broker: solo a las propiedades donde es el responsable.
 * - Cliente: solo a la propiedad con la que está vinculado (contrato vigente o inquilino registrado).
 */
export type PropertyAccess = 'ok' | 'not_found' | 'forbidden';

export function isAdmin(user: AuthUser): boolean {
  return user.type === 'staff' && user.roles.includes('admin');
}

export function isBroker(user: AuthUser): boolean {
  return user.type === 'staff' && user.roles.includes('broker');
}

export async function checkPropertyAccess(user: AuthUser, propertyId: string): Promise<PropertyAccess> {
  const brokerId = await Access.propertyBrokerId(propertyId);
  if (brokerId === undefined) return 'not_found';
  if (user.type === 'staff') {
    if (isAdmin(user)) return 'ok';
    return isBroker(user) && brokerId === user.id ? 'ok' : 'forbidden';
  }
  if (!user.clientId) return 'forbidden';
  return (await Access.clientLinkedToProperty(user.clientId, propertyId)) ? 'ok' : 'forbidden';
}

/** Igual que checkPropertyAccess pero lanza el error HTTP correspondiente. */
export async function assertPropertyAccess(user: AuthUser, propertyId: string): Promise<void> {
  const r = await checkPropertyAccess(user, propertyId);
  if (r === 'not_found') throw new AppError(404, 'NOT_FOUND', 'La propiedad no existe.');
  if (r === 'forbidden') throw new AppError(403, 'NOT_OWNER', 'No tienes acceso a esta propiedad.');
}

/** Alcance de propiedades para listados: null = todas (admin); arreglo = solo esas (broker o cliente). */
export async function propertyScope(user: AuthUser): Promise<string[] | null> {
  if (isAdmin(user)) return null;
  if (user.type === 'staff') return Access.brokerPropertyIds(user.id);
  return user.clientId ? Access.clientPropertyIds(user.clientId) : [];
}

/** Quita del objeto los datos del broker cuando la respuesta va para un cliente. */
export function forProfile<T extends Record<string, unknown>>(user: AuthUser, data: T): T {
  if (user.type === 'staff') return data;
  const copy = { ...data } as Record<string, unknown>;
  for (const k of ['broker', 'brokerId', 'broker_id', 'brokerName', 'broker_name', 'confirmedBy']) delete copy[k];
  return copy as T;
}
