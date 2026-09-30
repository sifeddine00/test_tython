import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../errors/AppError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import type { PublicUser } from '../users/user.dto.js';
import {
  assignTicket,
  changeTicketStatus,
  createTicket,
  getTicketById,
  getTickets,
  updateTicket,
} from './ticket.service.js';
import type {
  AssignTicketInput,
  CreateTicketInput,
  ListTicketsQuery,
  UpdateStatusInput,
  UpdateTicketInput,
} from './ticket.schema.js';

/** Contrôleur `tickets` : traduction HTTP uniquement, aucun SQL ni règle métier. */

function actor(req: Request): PublicUser {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  return req.user;
}

export const createTicketController = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await createTicket(req.body as CreateTicketInput, actor(req));
  res.status(201).json({ data: ticket });
});

export const listTicketsController = asyncHandler(async (req: Request, res: Response) => {
  const { tickets, meta } = await getTickets(req.query as unknown as ListTicketsQuery);
  res.status(200).json({ data: tickets, meta });
});

export const getTicketController = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await getTicketById(req.params['id'] as string);
  res.status(200).json({ data: ticket });
});

export const updateTicketController = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await updateTicket(
    req.params['id'] as string,
    req.body as UpdateTicketInput,
    actor(req),
  );
  res.status(200).json({ data: ticket });
});

export const updateStatusController = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await changeTicketStatus(
    req.params['id'] as string,
    req.body as UpdateStatusInput,
    actor(req),
  );
  res.status(200).json({ data: ticket });
});

export const assignTicketController = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await assignTicket(req.params['id'] as string, req.body as AssignTicketInput);
  res.status(200).json({ data: ticket });
});
