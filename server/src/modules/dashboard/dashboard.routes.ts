import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { getDashboardStatsController } from './dashboard.controller.js';

export const dashboardRouter = Router();

dashboardRouter.get('/stats', authenticate, getDashboardStatsController);
