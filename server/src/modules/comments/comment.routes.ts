import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { idParamSchema } from '../shared/schemas.js';
import { createCommentSchema } from './comment.schema.js';
import { addCommentController, listCommentsController } from './comment.controller.js';

export const commentsRouter = Router({ mergeParams: true });

commentsRouter.use(authenticate);

commentsRouter.post('/', validate({ params: idParamSchema, body: createCommentSchema }), addCommentController);

commentsRouter.get('/', validate({ params: idParamSchema }), listCommentsController);
