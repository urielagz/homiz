import 'dotenv/config';
import { z } from 'zod';

/* Variables de entorno validadas al arrancar: si falta algo obligatorio, el servidor no inicia. */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'Falta DATABASE_URL'),
  JWT_ACCESS_SECRET: z.string().default(''),
  JWT_REFRESH_SECRET: z.string().default(''),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_DAYS: z.coerce.number().int().positive().default(30),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
  CORS_ORIGINS: z.string().default(''),
  STORAGE_DRIVER: z.enum(['local', 'r2']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('uploads'),
  PUSH_DRIVER: z.enum(['mock', 'fcm']).default('mock'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Configuración inválida:', z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
  isProduction: parsed.data.NODE_ENV === 'production',
};
