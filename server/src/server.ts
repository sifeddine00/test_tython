import type { Request, Response } from 'express';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { closePool } from './db/pool.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.info(`[server] HelpDeskPro API à l'écoute sur http://localhost:${env.PORT}`);
  console.info(`[server] Documentation : http://localhost:${env.PORT}/api/docs`);
  console.info(`[server] Environnement : ${env.NODE_ENV}`);
});

/**
 * Arrêt propre : on cesse d'accepter de nouvelles connexions, on laisse les
 * requêtes en cours se terminer, puis on ferme le pool PostgreSQL.
 */
function shutdown(signal: string): void {
  console.info(`[server] Signal ${signal} reçu, arrêt en cours...`);

  server.close(() => {
    void closePool().then(() => {
      console.info('[server] Arrêt terminé.');
      process.exit(0);
    });
  });

  // Filet de sécurité si des connexions restent ouvertes.
  setTimeout(() => {
    console.error('[server] Arrêt forcé après expiration du délai.');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error('[server] Promesse rejetée non gérée :', reason);
});

export type ServerInstance = typeof server;
export type AppInstance = typeof app;
export type { Request, Response };
