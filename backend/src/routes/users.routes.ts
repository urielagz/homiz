import { Router } from 'express';
import * as C from '../controllers/users.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';

export const usersRouter = Router();

usersRouter.get('/me', authenticate, C.getMe);
usersRouter.patch('/me', authenticate, validate({ body: C.updateMeDto }), C.updateMe);
