import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { listAssignableUsers } from './user.repository.js';
import { toPublicUser } from './user.dto.js';
import type { ListUsersQuery } from './user.schema.js';

/**
 * Contrôleur `users`.
 * `GET /api/users` est la seule source du sélecteur d'assignation côté
 * frontend (écart documenté dans docs/DIFFERENCES.md).
 */
export const listUsersController = asyncHandler(async (req: Request, res: Response) => {
  const { role } = req.query as unknown as ListUsersQuery;
  const rows = await listAssignableUsers(role);

  res.status(200).json({ data: rows.map(toPublicUser) });
});
