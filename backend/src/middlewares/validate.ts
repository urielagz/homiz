import type { RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from './error-handler.js';

interface Schemas {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
}

/**
 * Valida y limpia body, query y params con zod (DTOs). Los valores validados quedan en res.locals.body,
 * res.locals.query y res.locals.params. Los errores se responden como VALIDATION_ERROR con el detalle
 * por campo: { campo: ["mensaje", ...] }.
 */
export function validate(schemas: Schemas): RequestHandler {
  return (req, res, next) => {
    const details: Record<string, string[]> = {};
    for (const part of ['params', 'query', 'body'] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part] ?? {});
      if (result.success) {
        res.locals[part] = result.data;
      } else {
        for (const issue of result.error.issues) {
          const key = issue.path.length ? issue.path.join('.') : part;
          (details[key] ??= []).push(issue.message);
        }
      }
    }
    if (Object.keys(details).length) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Revisa los datos enviados.', details);
    }
    next();
  };
}

/* Piezas comunes para los DTOs. */
export const emailField = z.email({ error: 'Escribe un correo válido, por ejemplo nombre@correo.com.' }).max(160).transform((v) => v.trim().toLowerCase());
export const nameField = z.string({ error: 'Escribe tu nombre.' }).trim().min(2, 'Escribe tu nombre completo.').max(120);
export const phoneField = z
  .string()
  .trim()
  .refine((v) => v.replace(/\D/g, '').length >= 10, 'El teléfono debe tener al menos 10 dígitos.')
  .max(30);
export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
