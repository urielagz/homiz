import argon2 from 'argon2';
import { z } from 'zod';

/** Política: mínimo 8 caracteres, con mayúscula, minúscula y número. */
export const passwordSchema = z
  .string({ error: 'Escribe una contraseña.' })
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(128, 'La contraseña no puede tener más de 128 caracteres.')
  .regex(/[A-ZÁÉÍÓÚÑ]/, 'La contraseña debe incluir al menos una mayúscula.')
  .regex(/[a-záéíóúñ]/, 'La contraseña debe incluir al menos una minúscula.')
  .regex(/\d/, 'La contraseña debe incluir al menos un número.');

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/* Hash ficticio para tardar lo mismo cuando el correo no existe (evita adivinar cuentas por tiempo de respuesta). */
let dummyHash: Promise<string> | null = null;
export async function verifyAgainstDummy(password: string): Promise<void> {
  dummyHash ??= hashPassword('Ficticia-0000');
  await verifyPassword(await dummyHash, password);
}
