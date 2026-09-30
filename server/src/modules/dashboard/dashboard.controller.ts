import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getDashboardStats } from './dashboard.service.js';

export const getDashboardStatsController = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await getDashboardStats();
  res.status(200).json({ data: stats });
});
