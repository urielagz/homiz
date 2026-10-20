import { Router } from 'express';
import { getHealth } from '../controllers/health.controller.js';

/* Rutas de la API v1. Cada módulo se monta aquí conforme se construye por fases. */
export const apiRouter = Router();

apiRouter.get('/health', getHealth);
