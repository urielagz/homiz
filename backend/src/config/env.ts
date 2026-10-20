import 'dotenv/config';
import { z } from 'zod';

/* Variables de entorno validadas al arrancar: si falta algo obligatorio, el servidor no inicia. */
const secret = (name: string) =>
  z.string().min(32, `${name} debe tener al menos 32 caracteres (usa: npm run secrets)`);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'Falta DATABASE_URL'),
  JWT_ACCESS_SECRET: secret('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: secret('JWT_REFRESH_SECRET'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_DAYS: z.coerce.number().int().positive().default(30),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
  PASSWORD_RESET_MINUTES: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().positive().default(20),
  CORS_ORIGINS: z.string().default(''),
  APP_RESET_URL: z.string().default('http://localhost:5500/web/admin/login.html'),
  MAIL_OUTBOX_DIR: z.string().default('outbox'),
  API_PUBLIC_URL: z.string().default('http://localhost:3000'),
  STORAGE_DRIVER: z.enum(['local', 'r2']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('uploads'),
  STORAGE_URL_MINUTES: z.coerce.number().int().positive().default(15),
  R2_ACCOUNT_ID: z.string().default(''),
  R2_ACCESS_KEY_ID: z.string().default(''),
  R2_SECRET_ACCESS_KEY: z.string().default(''),
  R2_BUCKET: z.string().default(''),
  PUSH_DRIVER: z.enum(['mock', 'fcm']).default('mock'),
  FCM_PROJECT_ID: z.string().default(''),
  FCM_CLIENT_EMAIL: z.string().default(''),
  FCM_PRIVATE_KEY: z.string().default(''),
  JOBS_ENABLED: z.enum(['true', 'false']).default('true'),
  JOBS_CRON: z.string().default('0 7 * * *'),
  TZ_APP: z.string().default('America/Cancun'),
})
  .refine((e) => e.STORAGE_DRIVER !== 'r2' || (e.R2_ACCOUNT_ID && e.R2_ACCESS_KEY_ID && e.R2_SECRET_ACCESS_KEY && e.R2_BUCKET), {
    message: 'Con STORAGE_DRIVER=r2 se requieren R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY y R2_BUCKET',
  })
  .refine((e) => e.PUSH_DRIVER !== 'fcm' || (e.FCM_PROJECT_ID && e.FCM_CLIENT_EMAIL && e.FCM_PRIVATE_KEY), {
    message: 'Con PUSH_DRIVER=fcm se requieren FCM_PROJECT_ID, FCM_CLIENT_EMAIL y FCM_PRIVATE_KEY',
  });

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Configuración inválida:\n' + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
  isProduction: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
};
