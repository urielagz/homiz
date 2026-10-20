import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
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
  app.use(helmet());
  app.use(
    cors({
      // CORS mínimo: solo los orígenes configurados (sitio web y panel).
      origin: (origin, cb) => cb(null, !origin || env.corsOrigins.includes(origin)),
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
