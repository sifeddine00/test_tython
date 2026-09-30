import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { corsOrigins, isProduction } from './config/env.js';
import { isDatabaseReachable } from './db/pool.js';
import { errorHandler } from './middleware/errorHandler.js';
import { NotFoundError } from './errors/AppError.js';
import { apiRouter } from './routes.js';
import { openApiDocument } from './openapi.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Assemblage de l'application Express.
 * `server.ts` ne fait que l'écoute réseau : ici on construit l'app, ce qui
 * permet aux tests de la monter sans ouvrir de port.
 */
export function createApp(): Express {
  const app = express();

  // Derrière un reverse proxy, req.ip doit refléter X-Forwarded-For pour que
  // la limitation de débit s'applique au bon client.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: false,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));

  app.get('/api/health', async (_req, res) => {
    const databaseReachable = await isDatabaseReachable();
    res.status(databaseReachable ? 200 : 503).json({
      data: {
        status: databaseReachable ? 'ok' : 'degraded',
        database: databaseReachable ? 'up' : 'down',
        uptime: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      },
    });
  });

  // Bonus 2 du CDC : documentation OpenAPI interactive.
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.get('/api/docs.json', (_req, res) => {
    res.status(200).json(openApiDocument);
  });

  app.use('/api', apiRouter);

  // En production, sert le build du frontend s'il a été généré.
  const clientDist = path.resolve(currentDir, '../../client/dist');
  if (isProduction) {
    app.use(express.static(clientDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        next();
        return;
      }
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use((req, _res, next) => {
    next(new NotFoundError(`Route ${req.method} ${req.path}`));
  });

  app.use(errorHandler);

  return app;
}
