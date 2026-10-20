import { Router } from 'express';
import * as C from '../controllers/public.controller.js';
import * as Leads from '../controllers/leads.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { requirePermission } from '../middlewares/authorize.js';
import { authLimiter } from '../middlewares/rate-limit.js';
import { idParam, validate } from '../middlewares/validate.js';

/* Sin sesión: lo que usa el sitio web. */
export const publicRouter = Router();
publicRouter.get('/properties', validate({ query: C.catalogQueryDto }), C.catalog);
publicRouter.get('/properties/:slug', C.bySlug);
publicRouter.post('/leads', authLimiter, validate({ body: C.leadDto }), C.postLead);

/* Con sesión: el personal atiende las solicitudes. */
export const leadsRouter = Router();
leadsRouter.use(authenticate, requirePermission('leads.manage'));
leadsRouter.get('/', validate({ query: Leads.listQueryDto }), Leads.list);
leadsRouter.patch('/:id', validate({ params: idParam, body: Leads.statusDto }), Leads.updateStatus);
