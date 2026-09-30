import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { query, queryOne } from '../src/db/pool.js';
import { hashPassword } from '../src/utils/password.js';

/**
 * Utilitaires partagés par les tests.
 *
 * Les données sont créées par des factories explicites plutôt que par un seed :
 * chaque test ne dépend que des enregistrements qu'il a lui-même créés.
 */

export const app: Express = createApp();

export type Role = 'admin' | 'agent';

export type TestUser = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  token: string;
};

let userSequence = 0;

/**
 * Cache du hash pour le mot de passe commun des tests.
 *
 * bcrypt est volontairement lent (c'est le but) : le recalculer pour chacun des
 * ~300 utilisateurs de la suite coûterait plusieurs minutes. Le hash est donc
 * calculé une fois puis réutilisé — la sécurité n'est pas testée ici, elle est
 * testée par le coût effectif appliqué en production.
 */
const DEFAULT_TEST_PASSWORD = 'Password123!';
let cachedDefaultHash: string | null = null;

async function hashTestPassword(password: string): Promise<string> {
  if (password === DEFAULT_TEST_PASSWORD) {
    cachedDefaultHash ??= await hashPassword(password);
    return cachedDefaultHash;
  }
  return hashPassword(password);
}

export async function createUser(
  role: Role,
  overrides: { fullName?: string; email?: string; password?: string } = {},
): Promise<Omit<TestUser, 'token'>> {
  userSequence += 1;
  const suffix = `${Date.now()}_${userSequence}`;
  const email = overrides.email ?? `${role}.${suffix}@helpdeskpro.test`;
  const fullName = overrides.fullName ?? `Utilisateur ${role} ${userSequence}`;
  const password = overrides.password ?? DEFAULT_TEST_PASSWORD;

  const passwordHash = await hashTestPassword(password);
  const row = await queryOne<{ id: string; email: string; full_name: string; role: Role }>(
    `INSERT INTO users (email, full_name, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, full_name, role`,
    [email, fullName, passwordHash, role],
  );

  if (!row) {
    throw new Error('Création de l\'utilisateur de test échouée.');
  }

  return { id: row.id, email: row.email, fullName: row.full_name, role: row.role };
}

export async function loginUser(
  user: { email: string },
  password = DEFAULT_TEST_PASSWORD,
): Promise<TestUser> {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: user.email, password })
    .expect(200);

  const { token, user: profile } = response.body.data as {
    token: string;
    user: { id: string; email: string; fullName: string; role: Role };
  };

  return { ...profile, token };
}

/** Crée un utilisateur et renvoie directement sa session. */
export async function createLoggedInUser(
  role: Role,
  overrides: { fullName?: string; email?: string; password?: string } = {},
): Promise<TestUser> {
  const user = await createUser(role, overrides);
  return loginUser(user, overrides.password);
}

export type TicketOverrides = {
  title?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  status?: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdBy?: string;
  assignedTo?: string | null;
  resolvedBy?: string | null;
};

export type TestTicket = {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdBy: string;
  assignedTo: string | null;
  resolvedBy: string | null;
};

let ticketSequence = 0;

/**
 * Insère un ticket directement en base.
 *
 * L'insertion directe est volontaire : elle permet de construire des états
 * que l'API interdit d'atteindre autrement, afin de tester que l'API les
 * refuse bien.
 */
export async function createTicket(overrides: TicketOverrides = {}): Promise<TestTicket> {
  ticketSequence += 1;
  const status = overrides.status ?? 'open';
  const isResolved = status === 'resolved' || status === 'closed';

  const title = overrides.title ?? `Ticket de test ${ticketSequence}`;
  const description =
    overrides.description ?? `Description du ticket de test numéro ${ticketSequence}.`;

  if (overrides.createdBy === undefined) {
    throw new Error('createTicket exige un `createdBy`.');
  }

  const row = await queryOne<TestTicket>(
    `INSERT INTO tickets
        (title, description, priority, status, created_by, assigned_to, resolved_by, resolved_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, title, description, priority, status, created_by, assigned_to, resolved_by`,
    [
      title,
      description,
      overrides.priority ?? 'medium',
      status,
      overrides.createdBy,
      overrides.assignedTo ?? null,
      isResolved ? (overrides.resolvedBy ?? overrides.assignedTo ?? overrides.createdBy) : null,
      isResolved ? new Date() : null,
    ],
  );

  if (!row) {
    throw new Error('Création du ticket de test échouée.');
  }

  return row;
}

export async function createComment(input: {
  ticketId: string;
  authorId: string;
  message?: string;
  /**
   * Horodatage d'insertion explicite. Surcharger permet d'écrire un test
   * d'ordre sans dépendre de la résolution d'horloge de la machine.
   */
  createdAt?: Date;
}): Promise<{ id: string }> {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO ticket_comments (ticket_id, author_id, message, created_at)
     VALUES ($1, $2, $3, COALESCE($4, now()))
     RETURNING id`,
    [
      input.ticketId,
      input.authorId,
      input.message ?? `Commentaire de test ${Date.now()}.`,
      input.createdAt ?? null,
    ],
  );

  if (!row) {
    throw new Error('Création du commentaire de test échouée.');
  }
  return row;
}

/** Vide les tables métier sans toucher au schéma. */
export async function truncateAll(): Promise<void> {
  await query('TRUNCATE ticket_comments, tickets, users RESTART IDENTITY CASCADE');
}
