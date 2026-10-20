import { Router } from 'express';
import { getHealth } from '../controllers/health.controller.js';
import { authRouter } from './auth.routes.js';
import { usersRouter } from './users.routes.js';
import { activityRouter } from './activity.routes.js';
import { publicRouter, leadsRouter } from './public.routes.js';
import { propertiesRouter } from './properties.routes.js';
import { clientsRouter, contractsRouter } from './clients.routes.js';
import { appointmentsRouter } from './appointments.routes.js';
import { paymentsRouter } from './payments.routes.js';
import {
  dashboardRouter, devicesRouter, documentsRouter, expensesRouter, filesRouter, maintenanceRouter, notificationsRouter,
  providersRouter, receiptsRouter, utilityServicesRouter,
} from './operations.routes.js';

/* Rutas de la API v1 (detalle en docs/api.md). */
export const apiRouter = Router();

apiRouter.get('/health', getHealth);
apiRouter.use('/auth', authRouter);
apiRouter.use('/public', publicRouter);
apiRouter.use('/files', filesRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/properties', propertiesRouter);
apiRouter.use('/leads', leadsRouter);
apiRouter.use('/clients', clientsRouter);
apiRouter.use('/contracts', contractsRouter);
apiRouter.use('/appointments', appointmentsRouter);
apiRouter.use('/promissory-notes', paymentsRouter);
apiRouter.use('/utility-services', utilityServicesRouter);
apiRouter.use('/receipts', receiptsRouter);
apiRouter.use('/maintenance-reports', maintenanceRouter);
apiRouter.use('/providers', providersRouter);
apiRouter.use('/expenses', expensesRouter);
apiRouter.use('/documents', documentsRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/devices', devicesRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/activity-log', activityRouter);
