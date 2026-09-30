import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  app,
  createLoggedInUser,
  createTicket,
  truncateAll,
  type TestTicket,
  type TestUser,
} from './helpers.js';

/**
 * Règles métier obligatoires du cahier des charges.
 *
 *   4.2 : un ticket ne peut passer à `closed` que s'il est déjà `resolved`.
 *   4.3 : impossible d'ajouter un commentaire à un ticket `closed`.
 */

let admin: TestUser;
let agent: TestUser;

beforeEach(async () => {
  await truncateAll();
  admin = await createLoggedInUser('admin');
  agent = await createLoggedInUser('agent');
});

describe('Règle 4.2 — closed uniquement depuis resolved', () => {
  it('refuse open -> closed', async () => {
    const ticket = await createTicket({ status: 'open', createdBy: agent.id });

    const response = await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ status: 'closed' })
      .expect(400);

    expect(response.body.error.code).toBe('TICKET_INVALID_STATUS_TRANSITION');
  });

  it('refuse in_progress -> closed', async () => {
    const ticket = await createTicket({ status: 'in_progress', createdBy: agent.id });

    const response = await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ status: 'closed' })
      .expect(400);

    expect(response.body.error.code).toBe('TICKET_INVALID_STATUS_TRANSITION');
  });

  it('autorise resolved -> closed', async () => {
    const ticket = await createTicket({ status: 'resolved', createdBy: agent.id, resolvedBy: agent.id });

    const response = await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ status: 'closed' })
      .expect(200);

    expect(response.body.data.status).toBe('closed');
  });

  it("refuse closed -> closed (le statut courant n'est pas resolved)", async () => {
    const ticket = await createTicket({ status: 'closed', createdBy: agent.id, resolvedBy: agent.id });

    const response = await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ status: 'closed' })
      .expect(400);

    expect(response.body.error.code).toBe('TICKET_INVALID_STATUS_TRANSITION');
  });

  it('n\'altère pas le statut du ticket après un refus', async () => {
    const ticket = await createTicket({ status: 'open', createdBy: agent.id });

    await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ status: 'closed' })
      .expect(400);

    const response = await request(app)
      .get(`/api/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${agent.token}`)
      .expect(200);

    expect(response.body.data.status).toBe('open');
  });

  it('le message d\'erreur cite le statut actuel', async () => {
    const ticket = await createTicket({ status: 'in_progress', createdBy: agent.id });

    const response = await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ status: 'closed' })
      .expect(400);

    expect(response.body.error.message).toContain('in_progress');
    expect(response.body.error.message).toContain('résolu');
  });

  it('permet le parcours complet open -> in_progress -> resolved -> closed', async () => {
    const ticket = await createTicket({ status: 'open', createdBy: agent.id });

    await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ status: 'in_progress' })
      .expect(200);

    await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ status: 'resolved' })
      .expect(200);

    const final = await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ status: 'closed' })
      .expect(200);

    expect(final.body.data.status).toBe('closed');
  });

  it("autorise l'administrateur aussi bien que l'agent sur la transition autorisée", async () => {
    const ticket = await createTicket({ status: 'resolved', createdBy: agent.id, resolvedBy: agent.id });

    await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'closed' })
      .expect(200);
  });

  it('refuse la fermeture par un agent non autorisé (403 avant la règle métier)', async () => {
    const other = await createLoggedInUser('agent');
    const ticket = await createTicket({ status: 'open', createdBy: agent.id });

    await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${other.token}`)
      .send({ status: 'closed' })
      .expect(403);
  });

  it('renvoie 404 sur un ticket inexistant', async () => {
    await request(app)
      .patch('/api/tickets/00000000-0000-4000-8000-000000000000/status')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'resolved' })
      .expect(404);
  });

  it('renvoie 400 sur un statut inconnu', async () => {
    const ticket = await createTicket({ status: 'open', createdBy: agent.id });

    await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ status: 'archived' })
      .expect(400);
  });
});

describe('Cohérence des informations de résolution', () => {
  it("pose resolved_at et resolved_by à la transition vers resolved", async () => {
    const ticket = await createTicket({ status: 'open', createdBy: agent.id });

    const response = await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ status: 'resolved' })
      .expect(200);

    expect(response.body.data.resolvedAt).not.toBeNull();
    expect(response.body.data.resolvedBy.id).toBe(agent.id);
  });

  it('conserve resolved_at en passant de resolved à closed', async () => {
    const ticket = await createTicket({ status: 'open', createdBy: agent.id });

    await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ status: 'resolved' })
      .expect(200);

    const closed = await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ status: 'closed' })
      .expect(200);

    expect(closed.body.data.resolvedAt).not.toBeNull();
  });

  it('efface resolved_at et resolved_by lors d\'une réouverture', async () => {
    const ticket = await createTicket({ status: 'resolved', createdBy: agent.id, resolvedBy: agent.id });

    const response = await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ status: 'open' })
      .expect(200);

    expect(response.body.data.status).toBe('open');
    expect(response.body.data.resolvedAt).toBeNull();
    expect(response.body.data.resolvedBy).toBeNull();
  });

  it("n'écrit aucun commentaire système lors d'un changement de statut", async () => {
    const ticket = await createTicket({ status: 'open', createdBy: agent.id });

    await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ status: 'in_progress' })
      .expect(200);

    // Le CDC n'expose qu'un champ `status` sur cette route et n'authorize aucun
    // commentaire automatique : la liste doit rester vide.
    const comments = await request(app)
      .get(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${agent.token}`)
      .expect(200);

    expect(comments.body.data).toHaveLength(0);
  });

  it('n\'écrit aucun commentaire en passant à closed', async () => {
    const ticket = await createTicket({ status: 'resolved', createdBy: agent.id, resolvedBy: agent.id });

    await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ status: 'closed' })
      .expect(200);

    const comments = await request(app)
      .get(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${agent.token}`)
      .expect(200);

    expect(comments.body.data).toHaveLength(0);
  });

  it('rejette un champ comment non défini par le CDC', async () => {
    const ticket = await createTicket({ status: 'open', createdBy: agent.id });

    await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ status: 'resolved', comment: 'Correctif déployé.' })
      .expect(400);
  });
});

describe('Règle 4.3 — pas de commentaire sur un ticket closed', () => {
  const closedTicket = (): Promise<TestTicket> =>
    createTicket({ status: 'closed', createdBy: agent.id, resolvedBy: agent.id });

  it('refuse un commentaire sur un ticket closed avec 400', async () => {
    const ticket = await closedTicket();

    const response = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ message: 'Je tente de commenter un ticket fermé.' })
      .expect(400);

    expect(response.body.error.code).toBe('COMMENT_ON_CLOSED_TICKET');
  });

  it('autorise un commentaire sur un ticket open', async () => {
    const ticket = await createTicket({ status: 'open', createdBy: agent.id });

    const response = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ message: 'Je travaille sur ce ticket.' })
      .expect(201);

    expect(response.body.data.message).toBe('Je travaille sur ce ticket.');
    expect(response.body.data.author.id).toBe(agent.id);
  });

  it('autorise un commentaire sur un ticket in_progress', async () => {
    const ticket = await createTicket({ status: 'in_progress', createdBy: agent.id });

    await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ message: 'Diagnostic en cours.' })
      .expect(201);
  });

  it('autorise un commentaire sur un ticket resolved', async () => {
    const ticket = await createTicket({ status: 'resolved', createdBy: agent.id, resolvedBy: agent.id });

    await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ message: 'Merci pour la résolution rapide.' })
      .expect(201);
  });

  it('refuse aussi pour un administrateur', async () => {
    const ticket = await closedTicket();

    await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ message: 'Même un administrateur ne peut pas commenter un ticket fermé.' })
      .expect(400);
  });

  it("n'enregistre aucun commentaire en cas de refus", async () => {
    const ticket = await closedTicket();

    await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ message: 'Ce commentaire ne doit pas être enregistré.' })
      .expect(400);

    const comments = await request(app)
      .get(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${agent.token}`)
      .expect(200);

    expect(comments.body.data).toHaveLength(0);
  });

  it('permet à nouveau un commentaire après réouverture du ticket', async () => {
    const ticket = await closedTicket();

    await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ message: 'Refusé car fermé.' })
      .expect(400);

    // Réouverture : le ticket repasse à open, le déblocage doit suivre.
    await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'open' })
      .expect(200);

    await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ message: 'Le ticket est rouvert, commentaire accepté.' })
      .expect(201);
  });

  it('renvoie 404 pour un ticket inexistant plutôt que 400', async () => {
    await request(app)
      .post('/api/tickets/00000000-0000-4000-8000-000000000000/comments')
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ message: 'Message quelconque.' })
      .expect(404);
  });

  it('exige une authentification', async () => {
    const ticket = await createTicket({ status: 'open', createdBy: agent.id });

    await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .send({ message: 'Sans jeton.' })
      .expect(401);
  });
});
