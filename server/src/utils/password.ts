import bcrypt from 'bcrypt';
import { env } from '../config/env.js';

/**
 * bcrypt tronque silencieusement les mots de passe dépassant 72 octets.
 * On refuse explicitement les valeurs trop longues pour éviter que
 * deux mots de passe différents deviennent indistinguables après hachage.
 */
export const BCRYPT_MAX_PASSWORD_BYTES = 72;

export function isPasswordTooLong(password: string): boolean {
  return Buffer.byteLength(password, 'utf8') > BCRYPT_MAX_PASSWORD_BYTES;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, env.BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
