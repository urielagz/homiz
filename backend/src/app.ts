import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';

/** Origen permitido: igual a uno de CORS_ORIGINS o a un patrón con «*» (p. ej. https://*.devtunnels.ms). */
export function corsAllowed(origin: string, allowed: string[] = env.corsOrigins): boolean {
  return allowed.some((o) =>
    o.includes('*')
      ? new RegExp('^' + o.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\/]/g, '\\$&')).join('[a-z0-9-]+') + '$', 'i').test(origin)
      : o === origin,
  );
}
import { logger } from './config/logger.js';
import { requestId } from './middlewares/request-id.js';
import { errorHandler, notFound } from './middlewares/error-handler.js';
import { globalLimiter } from './middlewares/rate-limit.js';
import { apiRouter } from './routes/index.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (_req, res) => res.locals.requestId,
      serializers: { req: (req) => ({ id: req.id, method: req.method, url: req.url }) },
    }),
  );
  // Las fotos firmadas (/files/:token) se muestran desde el sitio, el panel y la app, que viven en otro origen.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      // CORS mínimo: solo los orígenes configurados (sitio web, panel y app web).
      origin: (origin, cb) => cb(null, !origin || corsAllowed(origin)),
      credentials: false,
    }),
  );
  app.use(globalLimiter);
  app.use(express.json({ limit: '1mb' }));

  app.use('/api/v1', apiRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
