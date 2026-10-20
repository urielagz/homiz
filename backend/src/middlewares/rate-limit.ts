import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const message = (text: string) => ({ error: { code: 'RATE_LIMITED', message: text, details: null } });

/** Límite global por IP. */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: message('Demasiadas solicitudes. Intenta de nuevo en unos minutos.'),
});

/** Límite estricto para inicio de sesión y recuperación de contraseña (por IP). */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.RATE_LIMIT_LOGIN_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: message('Demasiados intentos desde esta conexión. Espera unos minutos e inténtalo de nuevo.'),
});
