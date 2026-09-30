import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { listUsersQuerySchema } from './user.schema.js';
import { listUsersController } from './user.controller.js';

export const usersRouter = Router();

// Accessible à tout utilisateur authentifié : nécessaire pour l'assignation.
usersRouter.get('/', authenticate, validate({ query: listUsersQuerySchema }), listUsersController);
