import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { idParamSchema } from '../shared/schemas.js';
import {
  assignTicketSchema,
  createTicketSchema,
  listTicketsQuerySchema,
  updateStatusSchema,
  updateTicketSchema,
} from './ticket.schema.js';
import {
  assignTicketController,
  createTicketController,
  getTicketController,
  listTicketsController,
  updateStatusController,
  updateTicketController,
} from './ticket.controller.js';

export const ticketsRouter = Router();

// Toutes les routes de ce module exigent une authentification valide.
ticketsRouter.use(authenticate);

ticketsRouter.post('/', validate({ body: createTicketSchema }), createTicketController);

ticketsRouter.get('/', validate({ query: listTicketsQuerySchema }), listTicketsController);

ticketsRouter.get('/:id', validate({ params: idParamSchema }), getTicketController);

ticketsRouter.put(
  '/:id',
  validate({ params: idParamSchema, body: updateTicketSchema }),
  updateTicketController,
);

ticketsRouter.patch(
  '/:id/status',
  validate({ params: idParamSchema, body: updateStatusSchema }),
  updateStatusController,
);

// L'assignation est réservée à l'administrateur (403 pour un agent).
ticketsRouter.patch(
  '/:id/assign',
  requireRole('admin'),
  validate({ params: idParamSchema, body: assignTicketSchema }),
  assignTicketController,
);
