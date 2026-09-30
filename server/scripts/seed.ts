import { Client } from 'pg';
import bcrypt from 'bcrypt';

/**
 * Jeu de données de démonstration (section 8 du cahier des charges) :
 *   - 1 administrateur
 *   - 2 agents
 *   - 10 tickets répartis sur les 4 statuts
 *   - 20 commentaires
 *
 * Choix de conception
 * -------------------
 * - Idempotent : les tables sont tronquées avant insertion, le seed peut donc
 *   être rejoué sans accumuler de données.
 * - Les mots de passe sont hachés par le code, jamais stockés en clair.
 * - Les 20 commentaires portent exclusivement sur des tickets non fermés.
 *   La règle métier 4.3 interdit d'ajouter un commentaire à un ticket
 *   `closed` : en mettre sur un ticket fermé rendrait le jeu de données
 *   incohérent avec la règle que l'API applique.
 * - Les tickets `resolved` et `closed` portent `resolved_by` / `resolved_at`
 *   pour satisfaire la contrainte CHECK `tickets_resolution_consistency`.
 */

const PASSWORD = 'Password123!';
const BCRYPT_ROUNDS = 12;

type SeedUser = {
  key: string;
  email: string;
  fullName: string;
  role: 'admin' | 'agent';
};

type SeedTicket = {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdBy: string;
  assignedTo: string | null;
  resolvedBy: string | null;
  /** Position dans le jeu : permet de dater les créations et commentaires. */
  ageHours: number;
};

const USERS: SeedUser[] = [
  { key: 'admin', email: 'admin@helpdeskpro.com', fullName: 'Claire Fontaine', role: 'admin' },
  { key: 'agent1', email: 'karim.benali@helpdeskpro.com', fullName: 'Karim Benali', role: 'agent' },
  { key: 'agent2', email: 'sofia.marchand@helpdeskpro.com', fullName: 'Sofia Marchand', role: 'agent' },
];

const TICKETS: SeedTicket[] = [
  {
    title: 'Impossible de se connecter au VPN',
    description:
      "Depuis la mise à jour du pare-feu, la connexion VPN échoue avec l'erreur « gateway unreachable » pour tous les collaborateurs distants.",
    priority: 'high',
    status: 'open',
    createdBy: 'admin',
    assignedTo: null,
    resolvedBy: null,
    ageHours: 5,
  },
  {
    title: 'Erreur 500 sur la page de facturation',
    description:
      'La page /facturation renvoie une erreur 500 depuis environ 30 minutes. Le rapport indique un dépassement de délai sur la requête de consolidation.',
    priority: 'high',
    status: 'in_progress',
    createdBy: 'admin',
    assignedTo: 'agent1',
    resolvedBy: null,
    ageHours: 9,
  },
  {
    title: 'Demande de nouveau compte e-mail',
    description:
      'Un nouveau collaborateur rejoint l\'équipe lundi. Il nécessite une boîte e-mail ainsi que l\'accès à la messagerie partagée.',
    priority: 'low',
    status: 'resolved',
    createdBy: 'admin',
    assignedTo: 'agent2',
    resolvedBy: 'agent2',
    ageHours: 30,
  },
  {
    title: 'Espace disque saturé sur le serveur de fichiers',
    description:
      'Le serveur de fichiers signale un taux d\'occupation supérieur à 95 %. Les sauvegardes échouent et les utilisateurs ne peuvent plus enregistrer.',
    priority: 'high',
    status: 'resolved',
    createdBy: 'admin',
    assignedTo: 'agent1',
    resolvedBy: 'agent1',
    ageHours: 52,
  },
  {
    title: 'Demande d\'accès au reporting financier',
    description:
      'La nouvelle analyste a besoin d\'un accès en lecture seule au module de reporting financier pour la clôture mensuelle.',
    priority: 'medium',
    status: 'closed',
    createdBy: 'admin',
    assignedTo: 'agent2',
    resolvedBy: 'agent2',
    ageHours: 76,
  },
  {
    title: 'Impression réseau qui reste bloquée',
    description:
      'Les travaux d\'impression dans la compta restent en file d\'attente. Le redémarrage de l\'imprimante n\'a pas résolu le problème.',
    priority: 'medium',
    status: 'open',
    createdBy: 'agent1',
    assignedTo: 'agent1',
    resolvedBy: null,
    ageHours: 14,
  },
  {
    title: 'Synchronisation Outlook défaillante',
    description:
      'Outlook ne synchronise plus les messages depuis ce matin sur les postes du service commercial. La dernière mise à jour de l\'Outlook est suspectée.',
    priority: 'medium',
    status: 'in_progress',
    createdBy: 'agent1',
    assignedTo: 'agent1',
    resolvedBy: null,
    ageHours: 20,
  },
  {
    title: 'Mot de passe oublié sur le portail RH',
    description:
      'Un collaborateur a réinitialisé son mot de passe du portail RH et ne reçoit pas l\'email de confirmation.',
    priority: 'low',
    status: 'open',
    createdBy: 'agent2',
    assignedTo: null,
    resolvedBy: null,
    ageHours: 26,
  },
  {
    title: 'Vidéoprojecteur de la salle 3 ne détecte pas le PC',
    description:
      'Le vidéoprojecteur de la salle de réunion 3 ne détecte plus le portable en HDMI. Un changement de câble a été effectué sans succès.',
    priority: 'medium',
    status: 'resolved',
    createdBy: 'agent1',
    assignedTo: 'agent2',
    resolvedBy: 'agent2',
    ageHours: 100,
  },
  {
    title: 'Demande de licence pour l\'outil de dessin',
    description:
      'Le studio de création demande trois licences supplémentaires pour l\'outil de dessin vectoriel utilisé sur les campagnes marketing.',
    priority: 'low',
    status: 'closed',
    createdBy: 'agent2',
    assignedTo: 'agent1',
    resolvedBy: 'agent1',
    ageHours: 124,
  },
];

/**
 * 20 commentaires répartis sur les tickets non fermés (open, in_progress,
 * resolved). Le total est vérifié par une assertion en fin de script.
 */
const COMMENTS: Array<{ ticketIndex: number; author: string; message: string; offsetHours: number }> = [
  { ticketIndex: 0, author: 'admin', message: 'Signalement reçu par téléphone, je le transfère au support réseau.', offsetHours: 4.5 },
  { ticketIndex: 0, author: 'agent1', message: 'Je reproduis le problème depuis le poste de test, l\'erreur est identique.', offsetHours: 4 },
  { ticketIndex: 0, author: 'agent1', message: 'Je vérifie la configuration du pare-feu publiée cette semaine.', offsetHours: 3 },
  { ticketIndex: 0, author: 'admin', message: 'Merci, la direction commence à soulever des questions sur la prod.', offsetHours: 2 },
  { ticketIndex: 1, author: 'agent1', message: 'Incident confirmé, la page est inaccessible pour tous les utilisateurs.', offsetHours: 8.5 },
  { ticketIndex: 1, author: 'agent2', message: 'Je rollback le déploiement de la version 2.4 pour confirmer la cause.', offsetHours: 7 },
  { ticketIndex: 1, author: 'agent1', message: 'Le rollback a résolu l\'erreur, je surveille les métriques.', offsetHours: 5.5 },
  { ticketIndex: 1, author: 'admin', message: 'Parfait, merci pour la réactivité sur ce point critique.', offsetHours: 5 },
  { ticketIndex: 2, author: 'agent2', message: 'Compte créé, j\'ai envoyé les identifiants au responsable hiérarchique.', offsetHours: 28 },
  { ticketIndex: 2, author: 'admin', message: 'Bien reçu, le collaborateur confirme que tout fonctionne.', offsetHours: 26.5 },
  { ticketIndex: 3, author: 'agent1', message: 'Analyse terminée : le cache de sauvegarde monopolise 78 Go.', offsetHours: 50 },
  { ticketIndex: 3, author: 'agent1', message: 'J\'ai purgé le cache et relance une sauvegarde complète, elle est en cours.', offsetHours: 45 },
  { ticketIndex: 3, author: 'admin', message: 'Le taux d\'occupation est repassé sous les 40 %, merci.', offsetHours: 44 },
  { ticketIndex: 5, author: 'agent1', message: 'L\'imprimante affiche une erreur de pilote, je cherche une version plus récente.', offsetHours: 13 },
  { ticketIndex: 5, author: 'agent1', message: 'Pilote mis à jour, un nouveau test d\'impression est demandé à l\'utilisateur.', offsetHours: 10 },
  { ticketIndex: 6, author: 'agent1', message: 'Problème confirmé sur deux postes, je cherche un profil de configuration défectueux.', offsetHours: 18 },
  { ticketIndex: 6, author: 'agent2', message: 'Je prépare un script de réparation du profil Outlook à diffuser.', offsetHours: 12 },
  { ticketIndex: 7, author: 'agent2', message: 'L\'email de confirmation part en erreur, je contacte le prestataire d\'envoi.', offsetHours: 24 },
  { ticketIndex: 8, author: 'agent2', message: 'Le câble HDMI de la salle était débranché derrière la table de conférence.', offsetHours: 99 },
  { ticketIndex: 8, author: 'agent1', message: 'Test validé avec le projecteur, la salle est de nouveau opérationnelle.', offsetHours: 97 },
];

const EXPECTED_USERS = 3;
const EXPECTED_TICKETS = 10;
const EXPECTED_COMMENTS = 20;

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

async function main(): Promise<void> {
  if (COMMENTS.length !== EXPECTED_COMMENTS) {
    throw new Error(
      `Le jeu de commentaires doit contenir ${EXPECTED_COMMENTS} entrées, or il y en a ${COMMENTS.length}.`,
    );
  }

  const { env } = await import('../src/config/env.js');
  const client = new Client({ connectionString: env.DATABASE_URL });
  await client.connect();

  try {
    // TRUNCATE ... CASCADE : réinitialise toutes les tables en une instruction.
    await client.query('TRUNCATE ticket_comments, tickets, users RESTART IDENTITY CASCADE');

    await client.query('BEGIN');

    const passwordHash = await bcrypt.hash(PASSWORD, BCRYPT_ROUNDS);
    const userIds = new Map<string, string>();

    for (const user of USERS) {
      const result = await client.query<{ id: string }>(
        `INSERT INTO users (email, full_name, password_hash, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [user.email, user.fullName, passwordHash, user.role],
      );
      userIds.set(user.key, result.rows[0]!.id);
    }

    const ticketIds: string[] = [];

    for (const ticket of TICKETS) {
      const createdAt = hoursAgo(ticket.ageHours);
      const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';

      const result = await client.query<{ id: string }>(
        `INSERT INTO tickets
            (title, description, priority, status, created_by, assigned_to, resolved_by, resolved_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          ticket.title,
          ticket.description,
          ticket.priority,
          ticket.status,
          userIds.get(ticket.createdBy)!,
          ticket.assignedTo ? userIds.get(ticket.assignedTo)! : null,
          isResolved ? userIds.get(ticket.resolvedBy!)! : null,
          isResolved ? hoursAgo(ticket.ageHours - 2) : null,
          createdAt,
          createdAt,
        ],
      );
      ticketIds.push(result.rows[0]!.id);
    }

    for (const comment of COMMENTS) {
      const ticketId = ticketIds[comment.ticketIndex];
      if (!ticketId) {
        throw new Error(`Ticket index ${comment.ticketIndex} introuvable dans le jeu de données.`);
      }

      await client.query(
        `INSERT INTO ticket_comments (ticket_id, author_id, message, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $4)`,
        [ticketId, userIds.get(comment.author)!, comment.message, hoursAgo(comment.offsetHours)],
      );
    }

    await client.query('COMMIT');

    const counts = await client.query<{
      users: string;
      tickets: string;
      ticket_comments: string;
    }>(`SELECT
          (SELECT count(*) FROM users)::text           AS users,
          (SELECT count(*) FROM tickets)::text         AS tickets,
          (SELECT count(*) FROM ticket_comments)::text AS ticket_comments`);

    const row = counts.rows[0]!;
    const summary = {
      users: Number(row.users),
      tickets: Number(row.tickets),
      comments: Number(row.ticket_comments),
    };

    console.info('[seed] Données insérées :', summary);

    const problems: string[] = [];
    if (summary.users !== EXPECTED_USERS) problems.push(`utilisateurs: ${summary.users} ≠ ${EXPECTED_USERS}`);
    if (summary.tickets !== EXPECTED_TICKETS) problems.push(`tickets: ${summary.tickets} ≠ ${EXPECTED_TICKETS}`);
    if (summary.comments !== EXPECTED_COMMENTS) problems.push(`commentaires: ${summary.comments} ≠ ${EXPECTED_COMMENTS}`);

    if (problems.length > 0) {
      throw new Error(`Le seed ne respecte pas le cahier des charges : ${problems.join(', ')}.`);
    }

    console.info('');
    console.info('[seed] Comptes de démonstration (mot de passe commun : Password123!) :');
    for (const user of USERS) {
      console.info(`  - ${user.role.padEnd(5)} | ${user.email}`);
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error('[seed] Échec :', error);
  process.exit(1);
});
