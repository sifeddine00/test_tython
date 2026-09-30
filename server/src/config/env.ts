import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Charge `server/.env` avant toute lecture de process.env. Le chemin est
// calculé depuis ce fichier pour être indépendant du répertoire d'exécution.
const currentDir = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(currentDir, '../../.env') });

/**
 * Schéma de validation des variables d'environnement.
 * L'application refuse de démarrer si une variable requise est absente
 * ou incohérente : l'échec est immédiat et explicite.
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(5000),

    DATABASE_URL: z
      .string()
      .min(1, 'DATABASE_URL est requise')
      .refine((v) => v.startsWith('postgres://') || v.startsWith('postgresql://'), {
        message: 'DATABASE_URL doit être une URL PostgreSQL',
      }),

    TEST_DATABASE_URL: z
      .string()
      .min(1, 'TEST_DATABASE_URL est requise')
      .refine((v) => v.startsWith('postgres://') || v.startsWith('postgresql://'), {
        message: 'TEST_DATABASE_URL doit être une URL PostgreSQL',
      }),

    JWT_SECRET: z
      .string()
      .min(32, 'JWT_SECRET doit contenir au moins 32 caractères'),

    JWT_EXPIRES_IN: z.string().min(1).default('8h'),

    BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

    CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),

    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  })
  .superRefine((values, ctx) => {
    if (values.NODE_ENV === 'production' && values.JWT_SECRET.includes('change-me')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET contient une valeur de démonstration, interdite en production',
      });
    }
  });

function loadEnv(): z.infer<typeof envSchema> {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(racine)'}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `Configuration d'environnement invalide :\n${details}\n\n` +
        'Copiez server/.env.example vers server/.env et renseignez les variables manquantes.',
    );
  }

  return result.data;
}

export const env = loadEnv();

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

/** Origines autorisées, sous forme de tableau pour le middleware CORS. */
export const corsOrigins: string[] = env.CORS_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);
