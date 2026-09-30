import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { loginSchema } from './auth.schema.js';
import { loginController, meController } from './auth.controller.js';

export const authRouter = Router();

/**
 * Limitation de débit sur la connexion : frein au force brute.
 * `skipSuccessfulRequests` : seul un échec compte, un utilisateur légitime
 * qui se connecte puis se reconnecte n'est jamais bloqué. En environnement de
 * test la limite est neutralisée pour ne pas fausser les scénarios 401.
 */
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === 'test' ? 10_000 : 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    error: {
      code: 'TOO_MANY_LOGIN_ATTEMPTS',
      message: 'Trop de tentatives de connexion. Réessayez dans quelques minutes.',
    },
  },
});

authRouter.post('/login', loginRateLimiter, validate({ body: loginSchema }), loginController);

authRouter.get('/me', authenticate, meController);
