import { Router } from 'express';
import { getHealth } from '../controllers/health.controller.js';
import { authRouter } from './auth.routes.js';
import { usersRouter } from './users.routes.js';
import { activityRouter } from './activity.routes.js';

/* Rutas de la API v1. Cada módulo se monta aquí conforme se construye por fases. */
export const apiRouter = Router();

apiRouter.get('/health', getHealth);
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/activity-log', activityRouter);
