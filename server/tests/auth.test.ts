import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, createLoggedInUser, createUser, loginUser, truncateAll } from './helpers.js';

/**
 * Section 4.1 du CDC : authentification JWT et rôles.
 */
describe('Authentification', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  describe('POST /api/auth/login', () => {
    it('retourne un jeton et le profil pour des identifiants valides', async () => {
      const user = await createUser('agent', { email: 'alice@example.test' });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: 'Password123!' })
        .expect(200);

      expect(response.body.data).toMatchObject({
        tokenType: 'Bearer',
        user: { id: user.id, email: user.email, role: 'agent' },
      });
      expect(typeof response.body.data.token).toBe('string');
      expect(response.body.data.token.split('.')).toHaveLength(3);
    });

    it('refuse un mot de passe incorrect avec 401', async () => {
      const user = await createUser('agent');

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: 'mauvais-mot-de-passe' })
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('renvoie le même message pour un email inconnu (pas de fuite d\'information)', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'inexistant@example.test', password: 'Password123!' })
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(response.body.error.message).toBe('Email ou mot de passe incorrect.');
    });

    it('est insensible à la casse sur l\'email', async () => {
      const user = await createUser('admin', { email: 'Claire.Fontaine@Example.test' });

      await request(app)
        .post('/api/auth/login')
        .send({ email: 'claire.fontaine@example.test', password: 'Password123!' })
        .expect(200);

      expect(user.role).toBe('admin');
    });

    it('rejette un email malformé avec 400', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'pas-un-email', password: 'Password123!' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejette un corps incomplet avec 400', async () => {
      const response = await request(app).post('/api/auth/login').send({}).expect(400);

      expect(response.body.error.details).toBeDefined();
      expect(response.body.error.details.length).toBeGreaterThan(0);
    });

    it('rejette un JSON malformé avec 400', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{ "email": ')
        .expect(400);

      expect(response.body.error.code).toBe('MALFORMED_JSON');
    });
  });

  describe('GET /api/auth/me', () => {
    it('refuse un accès sans jeton avec 401', async () => {
      const response = await request(app).get('/api/auth/me').expect(401);

      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('refuse un jeton syntaxiquement invalide avec 401', async () => {
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer pas-un-jwt')
        .expect(401);
    });

    it('refuse un schéma d\'authentification incorrect avec 401', async () => {
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Basic dXNlcjpwYXNz')
        .expect(401);
    });

    it('retourne le profil avec un jeton valide', async () => {
      const session = await createLoggedInUser('agent', { email: 'bob@example.test' });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${session.token}`)
        .expect(200);

      expect(response.body.data.user).toMatchObject({
        id: session.id,
        email: session.email,
        role: 'agent',
      });
    });

    it('ne divulgue jamais le hash du mot de passe', async () => {
      const session = await createLoggedInUser('admin');
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${session.token}`)
        .expect(200);

      expect(JSON.stringify(response.body)).not.toContain('password');
      expect(JSON.stringify(response.body)).not.toContain('$2b$');
    });

    it('rejette un jeton signé avec une autre clé', async () => {
      // Le jeton est bien formé mais la signature ne correspond pas.
      const response = await request(app)
        .get('/api/auth/me')
        .set(
          'Authorization',
          'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAiLCJyb2xlIjoiYWRtaW4ifQ.ZXlrc2lnbmF0dXJlLWZha2Utc2lnbmF0dXJl',
        )
        .expect(401);

      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/users', () => {
    it('est accessible à un agent authentifié', async () => {
      const session = await createLoggedInUser('agent');

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${session.token}`)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('exige une authentification', async () => {
      await request(app).get('/api/users').expect(401);
    });

    it('filtre par rôle', async () => {
      await createUser('admin', { email: 'admin.filtre@example.test' });
      const agent = await createUser('agent', { email: 'agent.filtre@example.test' });
      const session = await loginUser(agent);

      const response = await request(app)
        .get('/api/users?role=admin')
        .set('Authorization', `Bearer ${session.token}`)
        .expect(200);

      const users = response.body.data as Array<{ role: string }>;
      expect(users.length).toBeGreaterThan(0);
      expect(users.every((user) => user.role === 'admin')).toBe(true);
    });

    it('renvoie 400 sur un rôle invalide', async () => {
      const session = await createLoggedInUser('agent');

      await request(app)
        .get('/api/users?role=superuser')
        .set('Authorization', `Bearer ${session.token}`)
        .expect(400);
    });

    it('ne renvoie pas de hash de mot de passe', async () => {
      const session = await createLoggedInUser('agent');

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${session.token}`)
        .expect(200);

      expect(JSON.stringify(response.body)).not.toContain('password_hash');
      expect(JSON.stringify(response.body)).not.toContain('$2b$');
    });
  });
});
