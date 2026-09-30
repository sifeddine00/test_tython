import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../errors/AppError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import type { PublicUser } from '../users/user.dto.js';
import { addComment, getTicketComments } from './comment.service.js';
import type { CreateCommentInput } from './comment.schema.js';

/** Contrôleur commentaires : traduction HTTP uniquement. */

export const addCommentController = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError();
  }

  const comment = await addComment(
    req.params['id'] as string,
    req.user as PublicUser,
    req.body as CreateCommentInput,
  );

  res.status(201).json({ data: comment });
});

export const listCommentsController = asyncHandler(async (req: Request, res: Response) => {
  const comments = await getTicketComments(req.params['id'] as string);
  res.status(200).json({ data: comments });
});
