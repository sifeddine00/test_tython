import { z } from 'zod';
import { COMMENT_MAX } from '../shared/schemas.js';

export const createCommentSchema = z.object({
  message: z
    .string({ required_error: 'Le message est requis.' })
    .trim()
    .min(1, 'Le message ne peut pas être vide.')
    .max(COMMENT_MAX, `Le message ne peut pas dépasser ${COMMENT_MAX} caractères.`),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
