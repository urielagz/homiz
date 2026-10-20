import type { AuthUser } from '../middlewares/authenticate.js';
import * as Access from '../models/property-access.model.js';

/*
 * Pertenencia de recursos. Regla general:
 * - Administrador: acceso a todo (sus permisos se validan aparte con requirePermission).
 * - Broker: solo a las propiedades donde es el responsable.
 * - Cliente: solo a la propiedad con la que está vinculado (contrato vigente o inquilino registrado).
 */
export type PropertyAccess = 'ok' | 'not_found' | 'forbidden';

export function isAdmin(user: AuthUser): boolean {
  return user.roles.includes('admin');
}

export function isBroker(user: AuthUser): boolean {
  return user.roles.includes('broker');
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

/** Alcance de propiedades para listados: null = todas (admin); arreglo = solo esas. */
export async function propertyScope(user: AuthUser): Promise<string[] | null> {
  if (user.type === 'staff' && isAdmin(user)) return null;
  if (user.type === 'staff') return Access.brokerPropertyIds(user.id);
  return [];
}
