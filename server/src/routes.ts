import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes.js';
import { usersRouter } from './modules/users/user.routes.js';
import { ticketsRouter } from './modules/tickets/ticket.routes.js';
import { commentsRouter } from './modules/comments/comment.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/tickets', ticketsRouter);
apiRouter.use('/tickets/:id/comments', commentsRouter);
apiRouter.use('/dashboard', dashboardRouter);
