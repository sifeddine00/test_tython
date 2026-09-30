import { z } from 'zod';
import { userRoleSchema } from '../shared/schemas.js';

export const listUsersQuerySchema = z.object({
  role: userRoleSchema.optional(),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
