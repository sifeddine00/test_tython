/**
 * Smoke test bout-en-bout contre une API réellement démarrée.
 *
 * Ne fait pas partie de `npm test` : il vérifie le serveur tel qu'un utilisateur
 * le rencontre — démarrage réel, base de développement, seed d'origine — et non
 * l'application isolée comme le font les tests Vitest.
 *
 * Principe : une requête qui échoue doit être *rapportée*, pas lever une
 * exception. Toute lecture de `body.data` passe donc par un accès protégé, et
 * les deux appels dont dépend la suite extraient leur identifiant via
 * `unwrap`, qui échoue immédiatement avec un message explicite.
 *
 * Usage :
 *   npm run dev:server            # dans un autre terminal
 *   npm run smoke                 # depuis la racine
 */

const BASE_URL = process.env.SMOKE_BASE_URL ?? 'http://localhost:5000';

type Check = { label: string; ok: boolean; detail: string };

const checks: Check[] = [];

function record(label: string, ok: boolean, detail = ''): void {
  checks.push({ label, ok, detail });
}

type Envelope<T> = { status: number; body: T };

async function call<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string } = {},
): Promise<Envelope<T>> {
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token !== undefined) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  const text = await response.text();
  return {
    status: response.status,
    body: (text.length > 0 ? JSON.parse(text) : null) as T,
  };
}

/**
 * Extrait `data` d'une enveloppe de succès.
 *
 * Utilisé uniquement quand l'appel conditionne la suite : sans cela, un échec
 * de création produirait un `undefined` en cascade sur toutes les vérifications
 * suivantes, rendant le rapport illisible.
 */
function unwrap<T>(envelope: Envelope<{ data?: T }>, context: string): T {
  const value = envelope.body.data;

  if (value === undefined) {
    throw new Error(
      `${context} : HTTP ${envelope.status} sans champ "data". ` +
        `Réponse : ${JSON.stringify(envelope.body).slice(0, 300)}`,
    );
  }

  return value;
}

type Session = { token: string; userId: string; role: string };

async function login(email: string, password = 'Password123!'): Promise<Session> {
  const response = await call<{ data: { token: string; user: { id: string; role: string } } }>(
    '/api/auth/login',
    { method: 'POST', body: { email, password } },
  );

  const body = unwrap(response, `Connexion de ${email}`);

  return { token: body.token, userId: body.user.id, role: body.user.role };
}

async function main(): Promise<void> {
  console.info(`[smoke] Cible : ${BASE_URL}\n`);

  // ------------------------------------------------------------------- Santé
  const health = await call<{ data?: { status: string; database: string } }>('/api/health');
  record(
    'GET /api/health répond 200 et la base est joignable',
    health.status === 200 && health.body.data?.database === 'up',
    `status=${health.status} database=${health.body.data?.database ?? 'inconnue'}`,
  );

  // -------------------------------------------------------- Authentification
  const admin = await login('admin@helpdeskpro.com');
  record('Connexion administrateur', admin.token.length > 0, `role=${admin.role}`);

  const agent = await login('karim.benali@helpdeskpro.com');
  record('Connexion agent', agent.token.length > 0, `role=${agent.role}`);

  const other = await login('sofia.marchand@helpdeskpro.com');
  record('Connexion second agent', other.token.length > 0, `role=${other.role}`);

  const badLogin = await call('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@helpdeskpro.com', password: 'mauvais-mot-de-passe' },
  });
  record('Mot de passe erroné refusé en 401', badLogin.status === 401, `status=${badLogin.status}`);

  const unknownUser = await call('/api/auth/login', {
    method: 'POST',
    body: { email: 'inconnu@helpdeskpro.com', password: 'Password123!' },
  });
  record('E-mail inconnu refusé en 401', unknownUser.status === 401, `status=${unknownUser.status}`);

  const noAuth = await call('/api/tickets');
  record(
    'Route protégée refusée sans jeton en 401',
    noAuth.status === 401,
    `status=${noAuth.status}`,
  );

  const me = await call<{ data?: { email: string; role: string } }>('/api/auth/me', {
    token: agent.token,
  });
  record(
    'GET /api/auth/me renvoie le profil attendu',
    me.body.data?.email === 'karim.benali@helpdeskpro.com',
    me.body.data?.email ?? 'aucun profil',
  );

  // --------------------------------------------------------------------- Seed
  const list = await call<{ meta?: { total: number } }>('/api/tickets', { token: agent.token });
  record(
    'GET /api/tickets renvoie les 10 tickets du seed',
    list.body.meta?.total === 10,
    `total=${list.body.meta?.total ?? 'inconnu'}`,
  );

  const stats = await call<{
    data?: { totalTickets: number; byStatus: Record<string, number> };
  }>('/api/dashboard/stats', { token: admin.token });

  const statuses = stats.body.data?.byStatus ?? {};
  const expected: Record<string, number> = { open: 3, in_progress: 2, resolved: 3, closed: 2 };
  const seedMatches = Object.entries(expected).every(
    ([key, value]) => statuses[key] === value,
  );

  record(
    'Tableau de bord cohérent avec le seed',
    stats.body.data?.totalTickets === 10 && seedMatches,
    `total=${stats.body.data?.totalTickets ?? '?'} ` +
      Object.entries(statuses)
        .map(([key, value]) => `${key}=${value}`)
        .join(' '),
  );

  const topAgents = await call<{
    data?: { topAgents?: Array<{ fullName: string; resolvedCount: number }> };
  }>('/api/dashboard/stats', { token: admin.token });

  const ranking = topAgents.body.data?.topAgents ?? [];
  const sortedDesc = ranking.every(
    (entry, index) => index === 0 || (ranking[index - 1]?.resolvedCount ?? 0) >= entry.resolvedCount,
  );

  record(
    'Classement des agents non vide et trié du plus haut au plus bas',
    ranking.length > 0 && sortedDesc,
    ranking.map((entry) => `${entry.fullName}=${entry.resolvedCount}`).join(', ') || 'vide',
  );

  const users = await call<{ data?: Array<Record<string, unknown>> }>('/api/users', {
    token: admin.token,
  });

  const userList = users.body.data ?? [];
  const leaksHash = userList.some(
    (user) => 'passwordHash' in user || 'password_hash' in user,
  );

  record(
    'GET /api/users renvoie 3 utilisateurs et aucun hash de mot de passe',
    userList.length === 3 && !leaksHash,
    `count=${userList.length} fuite=${leaksHash}`,
  );

  // -------------------------------------------------------- Cycle de vie complet
  const created = await call<{
    data?: { id: string; status: string; priority: string };
  }>('/api/tickets', {
    method: 'POST',
    token: agent.token,
    body: {
      title: 'Ticket de vérification du smoke test',
      description: 'Créé automatiquement pour valider la chaîne complète de bout en bout.',
      priority: 'high',
    },
  });

  const ticket = unwrap(created, 'Création du ticket de vérification');
  const ticketId = ticket.id;
  record(
    "POST /api/tickets crée un ticket ouvert par l'agent",
    created.status === 201 && ticket.status === 'open' && ticket.priority === 'high',
    `id=${ticketId}`,
  );

  const badTitle = await call('/api/tickets', {
    method: 'POST',
    token: agent.token,
    body: { title: 'ab', description: 'Trop court pour le titre.' },
  });
  record('Titre trop court refusé en 400', badTitle.status === 400, `status=${badTitle.status}`);

  const unknownField = await call(`/api/tickets/${ticketId}/status`, {
    method: 'PATCH',
    token: agent.token,
    body: { status: 'resolved', comment: 'Champ non documenté' },
  });
  record(
    'Champ comment non documenté refusé en 400 sur /status',
    unknownField.status === 400,
    `status=${unknownField.status}`,
  );

  const statusViaPut = await call(`/api/tickets/${ticketId}`, {
    method: 'PUT',
    token: agent.token,
    body: { status: 'resolved' },
  });
  record(
    'PUT /tickets/:id refuse de changer le statut',
    statusViaPut.status === 400,
    `status=${statusViaPut.status}`,
  );

  // ------------------------------------------------- Règle 4.2 — fermeture
  const closeDirect = await call(`/api/tickets/${ticketId}/status`, {
    method: 'PATCH',
    token: agent.token,
    body: { status: 'closed' },
  });
  record(
    'Règle 4.2 : open -> closed refusé en 400',
    closeDirect.status === 400,
    `status=${closeDirect.status}`,
  );

  const toProgress = await call<{ data?: { status: string } }>(`/api/tickets/${ticketId}/status`, {
    method: 'PATCH',
    token: agent.token,
    body: { status: 'in_progress' },
  });
  record(
    'Transition open -> in_progress autorisée',
    toProgress.status === 200 && toProgress.body.data?.status === 'in_progress',
    `status=${toProgress.status}`,
  );

  const toResolved = await call<{ data?: { status: string; resolvedAt: string | null } }>(
    `/api/tickets/${ticketId}/status`,
    { method: 'PATCH', token: agent.token, body: { status: 'resolved' } },
  );
  record(
    'Transition in_progress -> resolved autorisée, resolved_at renseigné',
    toResolved.status === 200 &&
      toResolved.body.data?.status === 'resolved' &&
      toResolved.body.data?.resolvedAt !== null,
    `resolvedAt=${toResolved.body.data?.resolvedAt ?? 'null'}`,
  );

  const toClosed = await call<{ data?: { status: string } }>(`/api/tickets/${ticketId}/status`, {
    method: 'PATCH',
    token: agent.token,
    body: { status: 'closed' },
  });
  record(
    'Règle 4.2 : resolved -> closed autorisé',
    toClosed.status === 200 && toClosed.body.data?.status === 'closed',
    `status=${toClosed.status}`,
  );

  // -------------------------------------------- Règle 4.3 — commentaires
  const commentClosed = await call(`/api/tickets/${ticketId}/comments`, {
    method: 'POST',
    token: admin.token,
    body: { message: 'Tentative de commentaire sur un ticket fermé.' },
  });
  record(
    'Règle 4.3 : commentaire sur ticket closed refusé, même pour un admin',
    commentClosed.status === 400,
    `status=${commentClosed.status}`,
  );

  const commentClosedBis = await call(`/api/tickets/${ticketId}/comments`, {
    method: 'POST',
    token: agent.token,
    body: { message: 'Même refus pour un agent.' },
  });
  record('Règle 4.3 : refus également pour un agent', commentClosedBis.status === 400);

  // ---------------------------------------------------------------- Permissions
  const foreignCreated = await call<{ data?: { id: string } }>('/api/tickets', {
    method: 'POST',
    token: other.token,
    body: {
      title: 'Ticket appartenant au second agent',
      description: 'Sert à vérifier que les droits sont bien appliqués entre agents.',
    },
  });

  const foreign = unwrap(foreignCreated, 'Création du ticket du second agent');
  const foreignId = foreign.id;

  const foreignEdit = await call(`/api/tickets/${foreignId}`, {
    method: 'PUT',
    token: agent.token,
    body: { title: 'Tentative de modification interdite' },
  });
  record(
    "Agent ne peut pas modifier le ticket d'un autre agent (403)",
    foreignEdit.status === 403,
    `status=${foreignEdit.status}`,
  );

  const foreignStatus = await call(`/api/tickets/${foreignId}/status`, {
    method: 'PATCH',
    token: agent.token,
    body: { status: 'in_progress' },
  });
  record(
    "Agent ne peut pas changer le statut du ticket d'autrui (403)",
    foreignStatus.status === 403,
    `status=${foreignStatus.status}`,
  );

  const agentAssign = await call(`/api/tickets/${foreignId}/assign`, {
    method: 'PATCH',
    token: agent.token,
    body: { assignedTo: agent.userId },
  });
  record('Agent ne peut pas affecter un ticket (403)', agentAssign.status === 403, `status=${agentAssign.status}`);

  const adminEdit = await call<{ data?: { title: string } }>(`/api/tickets/${foreignId}`, {
    method: 'PUT',
    token: admin.token,
    body: { title: 'Titre modifié par un administrateur' },
  });
  record(
    "Administrateur peut modifier n'importe quel ticket",
    adminEdit.status === 200 && adminEdit.body.data?.title === 'Titre modifié par un administrateur',
    `status=${adminEdit.status}`,
  );

  const adminAssign = await call<{ data?: { assignedTo?: { id: string } | null } }>(
    `/api/tickets/${foreignId}/assign`,
    { method: 'PATCH', token: admin.token, body: { assignedTo: agent.userId } },
  );
  record(
    'Administrateur peut affecter un ticket à un agent',
    adminAssign.status === 200 && adminAssign.body.data?.assignedTo?.id === agent.userId,
    `status=${adminAssign.status}`,
  );

  const assignToAdmin = await call(`/api/tickets/${foreignId}/assign`, {
    method: 'PATCH',
    token: admin.token,
    body: { assignedTo: admin.userId },
  });
  record(
    'Affectation à un administrateur refusée en 400',
    assignToAdmin.status === 400,
    `status=${assignToAdmin.status}`,
  );

  const unassign = await call<{ data?: { assignedTo?: unknown } }>(`/api/tickets/${foreignId}/assign`, {
    method: 'PATCH',
    token: admin.token,
    body: { assignedTo: null },
  });
  record(
    'Désaffectation par null acceptée',
    unassign.status === 200 && (unassign.body.data?.assignedTo ?? null) === null,
    `status=${unassign.status}`,
  );

  // ------------------------------------------------------------------- Bilan
  // Les deux tickets créés par ce script restent en base : le CDC ne définit pas
  // de suppression, et en inventer une ici masquerait cette absence.
  // `npm run db:reset && npm run db:migrate && npm run db:seed` restaure un
  // état propre si nécessaire.
  console.info('-'.repeat(78));
  for (const check of checks) {
    console.info(
      `${check.ok ? 'OK   ' : 'ECHEC'} ${check.label}` +
        (check.detail === '' ? '' : `  -> ${check.detail}`),
    );
  }
  console.info('-'.repeat(78));

  const failed = checks.filter((check) => !check.ok);
  console.info(`[smoke] ${checks.length - failed.length}/${checks.length} vérification(s) réussie(s).`);

  if (failed.length > 0) {
    console.error(`[smoke] ${failed.length} vérification(s) en échec :`);
    for (const check of failed) {
      console.error(`  - ${check.label}${check.detail === '' ? '' : ` (${check.detail})`}`);
    }
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error('[smoke] Erreur inattendue :', error instanceof Error ? error.message : error);
  process.exit(1);
});