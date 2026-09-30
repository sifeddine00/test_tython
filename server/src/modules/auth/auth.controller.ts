import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../errors/AppError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import type { PublicUser } from '../users/user.dto.js';
import type { LoginInput } from './auth.schema.js';
import { login } from './auth.service.js';

/**
 * Contrôleur `auth` : traduit uniquement entre HTTP et service.
 * Le format de réponse est appliqué ici, jamais dans le service.
 */

export const loginController = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as LoginInput;
  const result = await login({ email, password });

  res.status(200).json({
    data: {
      token: result.token,
      tokenType: result.tokenType,
      expiresIn: result.expiresIn,
      user: result.user,
    },
  });
});

export const meController = asyncHandler(async (req: Request, res: Response) => {
  const user: PublicUser | undefined = req.user;

  if (!user) {
    throw new UnauthorizedError();
  }

  res.status(200).json({ data: { user } });
});
