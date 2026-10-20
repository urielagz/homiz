import { Router } from 'express';
import * as Clients from '../controllers/clients.controller.js';
import * as Contracts from '../controllers/contracts.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { requirePermission } from '../middlewares/authorize.js';
import { idParam, validate } from '../middlewares/validate.js';

export const clientsRouter = Router();
clientsRouter.use(authenticate, requirePermission('clients.manage'));
clientsRouter.get('/', validate({ query: Clients.listQueryDto }), Clients.list);
clientsRouter.get('/:id', validate({ params: idParam }), Clients.getOne);
clientsRouter.post('/', validate({ body: Clients.createDto }), Clients.create);
clientsRouter.patch('/:id', validate({ params: idParam, body: Clients.updateDto }), Clients.update);
clientsRouter.delete('/:id', validate({ params: idParam }), Clients.remove);

export const contractsRouter = Router();
contractsRouter.use(authenticate, requirePermission('contracts.manage'));
contractsRouter.get('/', validate({ query: Contracts.listQueryDto }), Contracts.list);
contractsRouter.get('/:id', validate({ params: idParam }), Contracts.getOne);
contractsRouter.post('/', validate({ body: Contracts.createDto }), Contracts.create);
contractsRouter.post('/:id/finish', validate({ params: idParam, body: Contracts.finishDto }), Contracts.finish);
