import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  app,
  createComment,
  createLoggedInUser,
  createTicket,
  truncateAll,
  type TestUser,
} from './helpers.js';

/**
 * Commentaires de suivi : lecture, écriture, validation du message et
 * rattachement à l'auteur authentifié.
 *
 * La règle 4.3 (refus sur ticket fermé) est couverte dans business-rules.test.ts.
 */

let admin: TestUser;
let agent: TestUser;

beforeEach(async () => {
  await truncateAll();
  admin = await createLoggedInUser('admin');
  agent = await createLoggedInUser('agent');
});

describe('POST /api/tickets/:id/comments', () => {
  it('crée un commentaire rattaché à l\'auteur authentifié', async () => {
    const ticket = await createTicket({ status: 'open', createdBy: agent.id });

    const response = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ message: 'Je regarde ce ticket.' })
      .expect(201);

    expect(response.body.data).toMatchObject({
      message: 'Je regarde ce ticket.',
      ticketId: ticket.id,
      author: { id: agent.id, fullName: agent.fullName, role: 'agent' },
    });
    expect(response.body.data.id).toBeDefined();
    expect(response.body.data.createdAt).toBeDefined();
  });

  it('ne renvoie jamais le hash du mot de passe dans l\'auteur', async () => {
    const ticket = await createTicket({ status: 'open', createdBy: agent.id });

    const response = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ message: 'Un commentaire quelconque.' })
      .expect(201);

    expect(response.body.data.author.passwordHash).toBeUndefined();
    expect(response.body.data.author.password_hash).toBeUndefined();
  });

  it('permet à un administrateur de commenter', async () => {
    const ticket = await createTicket({ status: 'open', createdBy: agent.id });

    await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ message: 'Réponse de l\'équipe support.' })
      .expect(201);
  });

  it('permet à tout agent authentifié de commenter, même sur un ticket d\'autrui', async () => {
    const other = await createLoggedInUser('agent');
    const ticket = await createTicket({ status: 'open', createdBy: agent.id });

    // La règle d'auteur/assigné ne s'applique qu'aux modifications de ticket,
    // pas aux commentaires : commenter est ouvert à tout agent authentifié.
    await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${other.token}`)
      .send({ message: 'Je complète l\'information.' })
      .expect(201);
  });

  it('refuse un message vide avec 400', async () => {
    const ticket = await createTicket({ status: 'open', createdBy: agent.id });

    await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ message: '' })
      .expect(400);
  });

  it('refuse un message composé uniquement d\'espaces avec 400', async () => {
    const ticket = await createTicket({ status: 'open', createdBy: agent.id });

    await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ message: '      ' })
      .expect(400);
  });

  it('refuse un message absent avec 400', async () => {
    const ticket = await createTicket({ status: 'open', createdBy: agent.id });

    await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({})
      .expect(400);
  });

  it('refuse un message trop long avec 400', async () => {
    const ticket = await createTicket({ status: 'open', createdBy: agent.id });

    await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ message: 'a'.repeat(5001) })
      .expect(400);
  });

  it('accepte un message de 5000 caractères (limite exacte)', async () => {
    const ticket = await createTicket({ status: 'open', createdBy: agent.id });

    await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ message: 'a'.repeat(5000) })
      .expect(201);
  });

  it('refuse un corps vide avec 400', async () => {
    const ticket = await createTicket({ status: 'open', createdBy: agent.id });

    await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({})
      .expect(400);
  });

  it('refuse un champ author forcé : l\'auteur reste l\'utilisateur authentifié', async () => {
    const ticket = await createTicket({ status: 'open', createdBy: agent.id });

    const response = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ message: 'Tentative d\'usurpation.', authorId: admin.id })
      .expect(201);

    expect(response.body.data.author.id).toBe(agent.id);
  });

  it('refuse un jeton invalide avec 401', async () => {
    const ticket = await createTicket({ status: 'open', createdBy: agent.id });

    await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', 'Bearer jeton.bidon.signature')
      .send({ message: 'Message quelconque.' })
      .expect(401);
  });

  it('renvoie 401 sans en-tête Authorization', async () => {
    const ticket = await createTicket({ status: 'open', createdBy: agent.id });

    await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .send({ message: 'Message quelconque.' })
      .expect(401);
  });

  it('renvoie 400 sur un identifiant de ticket malformé', async () => {
    await request(app)
      .post('/api/tickets/pas-un-uuid/comments')
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ message: 'Message quelconque.' })
      .expect(400);
  });
});

describe('GET /api/tickets/:id/comments', () => {
  it('renvoie un tableau vide pour un ticket sans commentaire', async () => {
    const ticket = await createTicket({ status: 'open', createdBy: agent.id });

    const response = await request(app)
      .get(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${agent.token}`)
      .expect(200);

    expect(response.body.data).toEqual([]);
  });

  it('renvoie les commentaires du plus ancien au plus récent', async () => {
    const ticket = await createTicket({ status: 'open', createdBy: agent.id });

    // Horodatages posés à la main : l'ordre ne doit dépendre ni de l'horloge
    // ni de l'ordre d'exécution des insertions.
    const base = Date.parse('2026-01-01T10:00:00.000Z');
    const messages = ['Premier message', 'Deuxième message', 'Troisième message'];

    for (const [index, message] of messages.entries()) {
      await createComment({
        ticketId: ticket.id,
        authorId: agent.id,
        message,
        createdAt: new Date(base + index * 60_000),
      });
    }

    const response = await request(app)
      .get(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${agent.token}`)
      .expect(200);

    expect(response.body.data).toHaveLength(3);
    expect(response.body.data.map((comment: { message: string }) => comment.message)).toEqual(
      messages,
    );
  });

  it('classe les commentaires selon un ordre décroissant si les dates sont inversées', async () => {
    const ticket = await createTicket({ status: 'open', createdBy: agent.id });
    const base = Date.parse('2026-01-01T10:00:00.000Z');

    await createComment({
      ticketId: ticket.id,
      authorId: agent.id,
      message: 'Le plus récent',
      createdAt: new Date(base + 120_000),
    });
    await createComment({
      ticketId: ticket.id,
      authorId: agent.id,
      message: 'Le plus ancien',
      createdAt: new Date(base),
    });

    const response = await request(app)
      .get(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${agent.token}`)
      .expect(200);

    expect(response.body.data.map((comment: { message: string }) => comment.message)).toEqual([
      'Le plus ancien',
      'Le plus récent',
    ]);
  });

  it('inclut l\'auteur complet de chaque commentaire', async () => {
    const ticket = await createTicket({ status: 'open', createdBy: agent.id });
    await createComment({ ticketId: ticket.id, authorId: agent.id, message: 'Message.' });

    const response = await request(app)
      .get(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${agent.token}`)
      .expect(200);

    const [comment] = response.body.data;
    expect(comment.author).toMatchObject({
      id: agent.id,
      email: agent.email,
      fullName: agent.fullName,
      role: 'agent',
    });
  });

  it('ne renvoie que les commentaires du ticket demandé', async () => {
    const mine = await createTicket({ status: 'open', createdBy: agent.id });
    const other = await createTicket({ status: 'open', createdBy: admin.id });
    await createComment({ ticketId: mine.id, authorId: agent.id, message: 'Le mien.' });
    await createComment({ ticketId: other.id, authorId: admin.id, message: 'Celui d\'autrui.' });

    const response = await request(app)
      .get(`/api/tickets/${mine.id}/comments`)
      .set('Authorization', `Bearer ${agent.token}`)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].message).toBe('Le mien.');
  });

  it('exige une authentification', async () => {
    const ticket = await createTicket({ status: 'open', createdBy: agent.id });

    await request(app).get(`/api/tickets/${ticket.id}/comments`).expect(401);
  });

  it('renvoie 404 pour un ticket inexistant', async () => {
    await request(app)
      .get('/api/tickets/00000000-0000-4000-8000-000000000000/comments')
      .set('Authorization', `Bearer ${agent.token}`)
      .expect(404);
  });

  it('renvoie 400 sur un identifiant malformé', async () => {
    await request(app)
      .get('/api/tickets/12345/comments')
      .set('Authorization', `Bearer ${agent.token}`)
      .expect(400);
  });

  it('autorise tout agent authentifié à lire les commentaires d\'un ticket d\'autrui', async () => {
    const other = await createLoggedInUser('agent');
    const ticket = await createTicket({ status: 'open', createdBy: agent.id });

    await request(app)
      .get(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${other.token}`)
      .expect(200);
  });
});