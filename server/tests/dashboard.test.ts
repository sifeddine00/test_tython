import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  app,
  createLoggedInUser,
  createTicket,
  truncateAll,
  type TestUser,
} from './helpers.js';

/**
 * GET /api/dashboard/stats — section 4.4 du CDC.
 *
 * Quatre éléments : total, répartition open / in_progress, top 5 agents.
 * Aucun ticket ne doit être visible du simple fait qu'il existe.
 */

let admin: TestUser;
let agent: TestUser;

beforeEach(async () => {
  await truncateAll();
  admin = await createLoggedInUser('admin');
  agent = await createLoggedInUser('agent');
});

const getStats = (token: string) =>
  request(app)
    .get('/api/dashboard/stats')
    .set('Authorization', `Bearer ${token}`)
    .expect(200)
    .then((response) => response.body.data as {
    totalTickets: number;
    byStatus: Record<string, number>;
    topAgents: Array<{ userId: string; fullName: string; email: string; resolvedCount: number }>;
  });

describe('GET /api/dashboard/stats — structure', () => {
  it('expose exactement les trois clés attendues', async () => {
    const stats = await getStats(agent.token);

    expect(Object.keys(stats).sort()).toEqual(['byStatus', 'topAgents', 'totalTickets']);
  });

  it('renvoie des compteurs à zéro sur une base vide', async () => {
    const stats = await getStats(agent.token);

    expect(stats.totalTickets).toBe(0);
    expect(stats.byStatus.open).toBe(0);
    expect(stats.byStatus.in_progress).toBe(0);
    expect(stats.topAgents).toEqual([]);
  });

  it('inclut les quatre statuts dans byStatus, même à zéro', async () => {
    const stats = await getStats(agent.token);

    // Le frontend affiche des cartes sans tester l'existence des clés.
    expect(Object.keys(stats.byStatus).sort()).toEqual([
      'closed',
      'in_progress',
      'open',
      'resolved',
    ]);
  });

  it('renvoie des nombres et non des chaînes PostgreSQL', async () => {
    await createTicket({ status: 'open', createdBy: agent.id });

    const stats = await getStats(agent.token);

    expect(typeof stats.totalTickets).toBe('number');
    expect(typeof stats.byStatus.open).toBe('number');
  });
});

describe('GET /api/dashboard/stats — compteurs', () => {
  it('compte tous les tickets, tous statuts confondus', async () => {
    await createTicket({ status: 'open', createdBy: agent.id });
    await createTicket({ status: 'in_progress', createdBy: agent.id });
    await createTicket({ status: 'resolved', createdBy: agent.id, resolvedBy: agent.id });
    await createTicket({ status: 'closed', createdBy: agent.id, resolvedBy: agent.id });

    const stats = await getStats(agent.token);

    expect(stats.totalTickets).toBe(4);
  });

  it('répartit les tickets par statut', async () => {
    await createTicket({ status: 'open', createdBy: agent.id });
    await createTicket({ status: 'open', createdBy: admin.id });
    await createTicket({ status: 'in_progress', createdBy: agent.id });
    await createTicket({ status: 'resolved', createdBy: agent.id, resolvedBy: agent.id });
    await createTicket({ status: 'closed', createdBy: agent.id, resolvedBy: agent.id });

    const stats = await getStats(agent.token);

    expect(stats.byStatus.open).toBe(2);
    expect(stats.byStatus.in_progress).toBe(1);
    expect(stats.byStatus.resolved).toBe(1);
    expect(stats.byStatus.closed).toBe(1);
    expect(stats.totalTickets).toBe(5);
  });

  it('reflète les changements de statut', async () => {
    const ticket = await createTicket({ status: 'open', createdBy: agent.id });

    await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ status: 'in_progress' })
      .expect(200);

    const stats = await getStats(agent.token);

    expect(stats.byStatus.open).toBe(0);
    expect(stats.byStatus.in_progress).toBe(1);
    expect(stats.totalTickets).toBe(1);
  });

  it('reflète la suppression logique via le changement de statut (aucun DELETE dans le CDC)', async () => {
    // Le CDC ne définit pas de suppression : le total ne diminue jamais.
    const ticket = await createTicket({ status: 'open', createdBy: agent.id });

    await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ status: 'closed' })
      .expect(400);

    const stats = await getStats(agent.token);

    expect(stats.totalTickets).toBe(1);
  });
});

describe('GET /api/dashboard/stats — top agents', () => {
  it('classe les agents par nombre de tickets résolus, du plus élevé au plus faible', async () => {
    const busy = await createLoggedInUser('agent');
    const quiet = await createLoggedInUser('agent');

    await createTicket({ status: 'resolved', createdBy: admin.id, resolvedBy: busy.id });
    await createTicket({ status: 'resolved', createdBy: admin.id, resolvedBy: busy.id });
    await createTicket({ status: 'closed', createdBy: admin.id, resolvedBy: busy.id });
    await createTicket({ status: 'resolved', createdBy: admin.id, resolvedBy: quiet.id });

    const stats = await getStats(admin.token);

    expect(stats.topAgents).toHaveLength(2);
    expect(stats.topAgents[0]).toMatchObject({
      userId: busy.id,
      resolvedCount: 3,
    });
    expect(stats.topAgents[1]).toMatchObject({
      userId: quiet.id,
      resolvedCount: 1,
    });
  });

  it('limite le classement à cinq agents', async () => {
    for (let index = 0; index < 7; index += 1) {
      const resolver = await createLoggedInUser('agent');
      await createTicket({ status: 'resolved', createdBy: admin.id, resolvedBy: resolver.id });
    }

    const stats = await getStats(admin.token);

    expect(stats.topAgents).toHaveLength(5);
  });

  it('exclut les agents n\'ayant rien résolu', async () => {
    await createLoggedInUser('agent');
    const resolver = await createLoggedInUser('agent');
    await createTicket({ status: 'resolved', createdBy: admin.id, resolvedBy: resolver.id });

    const stats = await getStats(admin.token);

    expect(stats.topAgents).toHaveLength(1);
    expect(stats.topAgents[0]?.userId).toBe(resolver.id);
  });

  it('ignore les tickets non résolus', async () => {
    const author = await createLoggedInUser('agent');
    await createTicket({ status: 'open', createdBy: author.id });
    await createTicket({ status: 'in_progress', createdBy: author.id });

    const stats = await getStats(admin.token);

    expect(stats.topAgents).toEqual([]);
  });

  it('inclut le nom complet et l\'email de chaque agent', async () => {
    const resolver = await createLoggedInUser('agent', {
      fullName: 'Karim Benali',
      email: 'karim.benali@helpdeskpro.test',
    });
    await createTicket({ status: 'resolved', createdBy: admin.id, resolvedBy: resolver.id });

    const stats = await getStats(admin.token);

    expect(stats.topAgents).toEqual([
      {
        userId: resolver.id,
        fullName: 'Karim Benali',
        email: 'karim.benali@helpdeskpro.test',
        resolvedCount: 1,
      },
    ]);
  });
});

describe('GET /api/dashboard/stats — contrôle d\'accès', () => {
  it('autorise un administrateur', async () => {
    await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
  });

  it('autorise un agent', async () => {
    await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${agent.token}`)
      .expect(200);
  });

  it('renvoie les mêmes statistiques à un admin et à un agent', async () => {
    await createTicket({ status: 'open', createdBy: agent.id });
    await createTicket({ status: 'resolved', createdBy: agent.id, resolvedBy: agent.id });

    const forAdmin = await getStats(admin.token);
    const forAgent = await getStats(agent.token);

    expect(forAgent).toEqual(forAdmin);
  });

  it('exige une authentification', async () => {
    await request(app).get('/api/dashboard/stats').expect(401);
  });

  it('refuse un jeton expiré avec 401', async () => {
    await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.signe_invalide')
      .expect(401);
  });
});