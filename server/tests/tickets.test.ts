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
 * Section 4.2 du CDC : gestion des tickets (CRUD, filtres, recherche).
 */

let admin: TestUser;
let agent1: TestUser;
let agent2: TestUser;

beforeEach(async () => {
  await truncateAll();
  admin = await createLoggedInUser('admin');
  agent1 = await createLoggedInUser('agent');
  agent2 = await createLoggedInUser('agent');
});

describe('POST /api/tickets', () => {
  it('crée un ticket avec le statut open et l\'auteur authentifié', async () => {
    const response = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${agent1.token}`)
      .send({
        title: 'Impossible de se connecter au VPN',
        description: 'La connexion échoue avec une erreur gateway unreachable.',
        priority: 'high',
      })
      .expect(201);

    expect(response.body.data).toMatchObject({
      title: 'Impossible de se connecter au VPN',
      priority: 'high',
      status: 'open',
      assignedTo: null,
      resolvedBy: null,
      resolvedAt: null,
    });
    expect(response.body.data.createdBy.id).toBe(agent1.id);
  });

  it('applique la priorité medium par défaut', async () => {
    const response = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${agent1.token}`)
      .send({ title: 'Ticket sans priorité', description: 'Description suffisamment longue.' })
      .expect(201);

    expect(response.body.data.priority).toBe('medium');
  });

  it('refuse un titre trop court avec 400', async () => {
    const response = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${agent1.token}`)
      .send({ title: 'ab', description: 'Description suffisamment longue.' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details?.[0]?.path).toBe('title');
  });

  it('refuse un titre de plus de 200 caractères avec 400', async () => {
    const response = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${agent1.token}`)
      .send({ title: 'a'.repeat(201), description: 'Description suffisamment longue.' })
      .expect(400);

    expect(response.body.error.details?.[0]?.path).toBe('title');
  });

  it('refuse une priorité inconnue avec 400', async () => {
    const response = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${agent1.token}`)
      .send({
        title: 'Titre valide',
        description: 'Description suffisamment longue.',
        priority: 'urgent',
      })
      .expect(400);

    expect(response.body.error.details?.[0]?.path).toBe('priority');
  });

  it('refuse la création sans authentification avec 401', async () => {
    await request(app)
      .post('/api/tickets')
      .send({ title: 'Titre valide', description: 'Description suffisamment longue.' })
      .expect(401);
  });
});

describe('GET /api/tickets', () => {
  async function seedTickets(): Promise<TestTicket[]> {
    return Promise.all([
      createTicket({ title: 'Panne réseau totale', createdBy: agent1.id, priority: 'high', status: 'open' }),
      createTicket({ title: 'Erreur de facturation', createdBy: agent1.id, priority: 'high', status: 'in_progress' }),
      createTicket({ title: 'Demande de licence', createdBy: agent2.id, priority: 'low', status: 'open' }),
      createTicket({ title: 'Espace disque plein', createdBy: admin.id, priority: 'medium', status: 'resolved', resolvedBy: agent1.id }),
      createTicket({ title: 'Imprimante bloquée', createdBy: admin.id, priority: 'medium', status: 'closed', assignedTo: agent2.id, resolvedBy: agent2.id }),
    ]);
  }

  it('retourne la liste paginée avec ses métadonnées', async () => {
    await seedTickets();

    const response = await request(app)
      .get('/api/tickets')
      .set('Authorization', `Bearer ${agent1.token}`)
      .expect(200);

    expect(response.body.data).toHaveLength(5);
    expect(response.body.meta).toEqual({ page: 1, limit: 20, total: 5, totalPages: 1 });
  });

  it('respecte la pagination', async () => {
    await seedTickets();

    const page1 = await request(app)
      .get('/api/tickets?page=1&limit=2')
      .set('Authorization', `Bearer ${agent1.token}`)
      .expect(200);

    expect(page1.body.data).toHaveLength(2);
    expect(page1.body.meta).toEqual({ page: 1, limit: 2, total: 5, totalPages: 3 });

    const page3 = await request(app)
      .get('/api/tickets?page=3&limit=2')
      .set('Authorization', `Bearer ${agent1.token}`)
      .expect(200);

    expect(page3.body.data).toHaveLength(1);
  });

  it('refuse un limit supérieur à 100 avec 400', async () => {
    await request(app)
      .get('/api/tickets?limit=500')
      .set('Authorization', `Bearer ${agent1.token}`)
      .expect(400);
  });

  it('filtre par statut', async () => {
    await seedTickets();

    const response = await request(app)
      .get('/api/tickets?status=open')
      .set('Authorization', `Bearer ${agent1.token}`)
      .expect(200);

    expect(response.body.data).toHaveLength(2);
    expect(
      (response.body.data as Array<{ status: string }>).every((t) => t.status === 'open'),
    ).toBe(true);
  });

  it('filtre par priorité', async () => {
    await seedTickets();

    const response = await request(app)
      .get('/api/tickets?priority=high')
      .set('Authorization', `Bearer ${agent1.token}`)
      .expect(200);

    expect(response.body.data).toHaveLength(2);
    expect(
      (response.body.data as Array<{ priority: string }>).every((t) => t.priority === 'high'),
    ).toBe(true);
  });

  it('filtre par agent assigné', async () => {
    await seedTickets();

    const response = await request(app)
      .get(`/api/tickets?assignedTo=${agent2.id}`)
      .set('Authorization', `Bearer ${agent1.token}`)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].assignedTo.id).toBe(agent2.id);
  });

  it('filtre les tickets non assignés avec le mot-clé "unassigned"', async () => {
    await seedTickets();

    const response = await request(app)
      .get('/api/tickets?assignedTo=unassigned')
      .set('Authorization', `Bearer ${agent1.token}`)
      .expect(200);

    expect(response.body.data).toHaveLength(4);
    expect(
      (response.body.data as Array<{ assignedTo: unknown }>).every((t) => t.assignedTo === null),
    ).toBe(true);
  });

  it('combine plusieurs filtres', async () => {
    await seedTickets();

    const response = await request(app)
      .get('/api/tickets?status=open&priority=high')
      .set('Authorization', `Bearer ${agent1.token}`)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].title).toBe('Panne réseau totale');
  });

  it('recherche dans le titre', async () => {
    await seedTickets();

    const response = await request(app)
      .get('/api/tickets?search=imprimante')
      .set('Authorization', `Bearer ${agent1.token}`)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].title).toBe('Imprimante bloquée');
  });

  it('recherche dans la description', async () => {
    const ticket = await createTicket({
      title: 'Incident réseau',
      description: 'La connexion au serveur de fichiers est perdue depuis ce matin.',
      createdBy: agent1.id,
    });

    const response = await request(app)
      .get('/api/tickets?search=serveur de fichiers')
      .set('Authorization', `Bearer ${agent1.token}`)
      .expect(200);

    expect(response.body.data.map((t: { id: string }) => t.id)).toEqual([ticket.id]);
  });

  it('ignore la casse dans la recherche', async () => {
    await seedTickets();

    const response = await request(app)
      .get('/api/tickets?search=IMPRIMANTE')
      .set('Authorization', `Bearer ${agent1.token}`)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
  });

  it('retourne une liste vide si la recherche ne correspond à rien', async () => {
    await seedTickets();

    const response = await request(app)
      .get('/api/tickets?search=inexistant-totalement')
      .set('Authorization', `Bearer ${agent1.token}`)
      .expect(200);

    expect(response.body.data).toEqual([]);
    expect(response.body.meta.total).toBe(0);
  });

  it('refuse un statut invalide dans la query avec 400', async () => {
    await request(app)
      .get('/api/tickets?status=unknown')
      .set('Authorization', `Bearer ${agent1.token}`)
      .expect(400);
  });

  it('refuse un assignedTo non-UUID avec 400', async () => {
    await request(app)
      .get('/api/tickets?assignedTo=pas-un-uuid')
      .set('Authorization', `Bearer ${agent1.token}`)
      .expect(400);
  });

  it('trie du plus récent au plus ancien', async () => {
    const older = await createTicket({ title: 'Ancien', createdBy: agent1.id });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const newer = await createTicket({ title: 'Récent', createdBy: agent1.id });

    const response = await request(app)
      .get('/api/tickets')
      .set('Authorization', `Bearer ${agent1.token}`)
      .expect(200);

    const ids = (response.body.data as Array<{ id: string }>).map((t) => t.id);
    expect(ids[0]).toBe(newer.id);
    expect(ids[1]).toBe(older.id);
  });
});

describe('GET /api/tickets/:id', () => {
  it('retourne le ticket avec ses relations', async () => {
    const ticket = await createTicket({
      title: 'Ticket détaillé',
      createdBy: agent1.id,
      assignedTo: agent2.id,
    });

    const response = await request(app)
      .get(`/api/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(response.body.data.id).toBe(ticket.id);
    expect(response.body.data.createdBy.id).toBe(agent1.id);
    expect(response.body.data.assignedTo.id).toBe(agent2.id);
  });

  it('retourne 404 pour un ticket inexistant', async () => {
    const response = await request(app)
      .get('/api/tickets/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);

    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('retourne 400 pour un identifiant malformé', async () => {
    await request(app)
      .get('/api/tickets/pas-un-uuid')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(400);
  });

  it('retourne 401 sans authentification', async () => {
    await request(app).get('/api/tickets/00000000-0000-4000-8000-000000000000').expect(401);
  });
});

describe('PUT /api/tickets/:id', () => {
  it("l'agent peut modifier un ticket dont il est l'auteur", async () => {
    const ticket = await createTicket({ createdBy: agent1.id });

    const response = await request(app)
      .put(`/api/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${agent1.token}`)
      .send({ title: 'Titre mis à jour', priority: 'low' })
      .expect(200);

    expect(response.body.data.title).toBe('Titre mis à jour');
    expect(response.body.data.priority).toBe('low');
  });

  it("l'agent peut modifier un ticket qui lui est assigné", async () => {
    const ticket = await createTicket({ createdBy: admin.id, assignedTo: agent1.id });

    await request(app)
      .put(`/api/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${agent1.token}`)
      .send({ description: 'Nouvelle description du ticket.' })
      .expect(200);
  });

  it("l'agent ne peut pas modifier un ticket d'autrui non assigné (403)", async () => {
    const ticket = await createTicket({ createdBy: agent2.id });

    const response = await request(app)
      .put(`/api/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${agent1.token}`)
      .send({ title: 'Tentative interdite' })
      .expect(403);

    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it("l'administrateur peut modifier n'importe quel ticket", async () => {
    const ticket = await createTicket({ createdBy: agent1.id });

    await request(app)
      .put(`/api/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ title: 'Corrigé par un admin' })
      .expect(200);
  });

  it('ne permet pas de changer le statut via PUT', async () => {
    const ticket = await createTicket({ createdBy: agent1.id });

    const response = await request(app)
      .put(`/api/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${agent1.token}`)
      .send({ status: 'resolved' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('refuse un corps vide avec 400', async () => {
    const ticket = await createTicket({ createdBy: agent1.id });

    await request(app)
      .put(`/api/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${agent1.token}`)
      .send({})
      .expect(400);
  });

  it('retourne 404 sur un ticket inexistant', async () => {
    await request(app)
      .put('/api/tickets/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ title: 'Titre quelconque' })
      .expect(404);
  });
});

describe('PATCH /api/tickets/:id/assign', () => {
  it("l'administrateur peut assigner un ticket à un agent", async () => {
    const ticket = await createTicket({ createdBy: agent1.id });

    const response = await request(app)
      .patch(`/api/tickets/${ticket.id}/assign`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ assignedTo: agent2.id })
      .expect(200);

    expect(response.body.data.assignedTo.id).toBe(agent2.id);
  });

  it("l'agent reçoit 403 sur l'assignation", async () => {
    const ticket = await createTicket({ createdBy: agent1.id });

    const response = await request(app)
      .patch(`/api/tickets/${ticket.id}/assign`)
      .set('Authorization', `Bearer ${agent1.token}`)
      .send({ assignedTo: agent2.id })
      .expect(403);

    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('permet de désassigner avec null', async () => {
    const ticket = await createTicket({ createdBy: agent1.id, assignedTo: agent2.id });

    const response = await request(app)
      .patch(`/api/tickets/${ticket.id}/assign`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ assignedTo: null })
      .expect(200);

    expect(response.body.data.assignedTo).toBeNull();
  });

  it("refuse d'assigner à un administrateur (400)", async () => {
    const ticket = await createTicket({ createdBy: agent1.id });

    const response = await request(app)
      .patch(`/api/tickets/${ticket.id}/assign`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ assignedTo: admin.id })
      .expect(400);

    expect(response.body.error.code).toBe('ASSIGNEE_MUST_BE_AGENT');
  });

  it('refuse un UUID inexistant avec 400', async () => {
    const ticket = await createTicket({ createdBy: agent1.id });

    await request(app)
      .patch(`/api/tickets/${ticket.id}/assign`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ assignedTo: '00000000-0000-4000-8000-000000000000' })
      .expect(400);
  });

  it('refuse une charge utile vide avec 400', async () => {
    const ticket = await createTicket({ createdBy: agent1.id });

    await request(app)
      .patch(`/api/tickets/${ticket.id}/assign`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({})
      .expect(400);
  });

  it('retourne 404 sur un ticket inexistant', async () => {
    await request(app)
      .patch('/api/tickets/00000000-0000-4000-8000-000000000000/assign')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ assignedTo: agent2.id })
      .expect(404);
  });
});
