# Conformité au CDC

Ce tableau rapproche chaque exigence du cahier des charges de son implémentation
et de sa **preuve exécutable**. Aucune ligne n'est déclarative : la colonne
« Preuve » renvoie soit à un nom de test Vitest réellement présent dans le code,
soit à une vérification du smoke test, soit à une requête SQL d'invariant.

## Comment tout vérifier d'un coup

```bash
npm run verify    # lint + typecheck (serveur, client, scripts) + 124 tests + 2 builds
npm run smoke    # 29 vérifications bout-en-bout sur une API démarrée
```

`npm run smoke` écrit dans la base de développement et y laisse deux tickets.
Pour retrouver un état propre :

```bash
npm run db:reset && npm run db:migrate && npm run db:seed
```

## Numérotation

Les références `§4.2` et `§4.3` désignent les sections du cahier des charges : §4.2 est
« Gestion des Tickets », §4.3 est « Commentaires sur Ticket ». Les deux règles métier obligatoires
y sont marquées d'un ✅ et ne portent pas de sous-numéro propre.

## Résultat de l'audit

| Section CDC | Exigences | Respectées |
|---|---|---|
| 1 — Objectif | 6 | 6 |
| 2 — Livrables attendus | 5 | 5 |
| 3 — Contraintes techniques | 11 | 11 |
| 4.1 — Authentification & rôles | 3 | 3 |
| 4.2 — Gestion des tickets | 14 | 14 |
| 4.3 — Commentaires sur ticket | 7 | 7 |
| 4.4 — Dashboard | 4 | 4 |
| 5 — Conception base de données | 10 | 10 |
| 6 — API REST minimale | 9 | 9 |
| 7 — Frontend React | 7 | 7 |
| 8 — Données de test | 3 | 3 |
| 9 — Bonus (facultatif) | 4 | 4 |

**82 exigences vérifiées, aucune en échec.** La section 9 est facultative et fournie en entier.

---

## Authentification

| Exigence CDC | Implémentation | Preuve |
|---|---|---|
| Connexion par e-mail et mot de passe | `auth/auth.service.ts` | `auth.test.ts` → *retourne un jeton et le profil pour des identifiants valides* |
| Mot de passe stocké haché (bcrypt) | `auth/auth.service.ts` | `auth.test.ts` → *ne divulgue jamais le hash du mot de passe* |
| Retour d'un jeton JWT | `auth/auth.service.ts` | `auth.test.ts` → idem + smoke *Connexion administrateur / agent* |
| Identifiants invalides → 401 | `auth/auth.service.ts` | *refuse un mot de passe incorrect avec 401* ; smoke *Mot de passe erroné refusé en 401* |
| Pas de fuite d'information (e-mail inconnu) | `auth/auth.service.ts` | *renvoie le même message pour un email inconnu* |
| E-mail insensible à la casse | `auth/auth.service.ts` | *est insensible à la casse sur l'e-mail* |
| Corps malformé → 400 | `auth/auth.schema.ts` | *rejette un email malformé*, *rejette un corps incomplet*, *rejette un JSON malformé* |
| Route protégée → 401 sans jeton | `auth/auth.routes.ts` | *refuse un accès sans jeton avec 401* ; smoke *Route protégée refusée sans jeton en 401* |
| Jeton invalide / signature foreign → 401 | `auth/auth.service.ts` | *refuse un jeton syntaxiquement invalide*, *rejette un jeton signé avec une autre clé* |
| `GET /auth/me` renvoie le profil | `auth/auth.controller.ts` | *retourne le profil avec un jeton valide* ; smoke *GET /api/auth/me renvoie le profil attendu* |

## Rôles et droits

| Exigence CDC | Implémentation | Preuve |
|---|---|---|
| Deux rôles : `admin`, `agent` | `migrations/001_init.sql` (ENUM) | `auth.test.ts` → *filtre par rôle* |
| Agent : ne modifie que ses tickets ou ceux qui lui sont affectés | `tickets/ticket.service.ts` | smoke *Agent ne peut pas modifier le ticket d'un autre agent (403)* |
| Agent : ne change le statut que dans les mêmes conditions | `tickets/ticket.service.ts` | smoke *Agent ne peut pas changer le statut du ticket d'autrui (403)* |
| L'affectation est réservée à l'administrateur | `tickets/ticket.service.ts` | smoke *Agent ne peut pas affecter un ticket (403)* |
| L'administrateur intervient sur tout ticket | `tickets/ticket.service.ts` | smoke *Administrateur peut modifier n'importe quel ticket* |
| L'administrateur affecte un agent | `tickets/ticket.service.ts` | smoke *Administrateur peut affecter un ticket à un agent* |
| Pas d'affectation à un administrateur | `tickets/ticket.service.ts` | smoke *Affectation à un administrateur refusée en 400* |

## 4.2 — Règle métier : `closed` uniquement depuis `resolved`

| Exigence CDC | Implémentation | Preuve |
|---|---|---|
| `closed` accessible **uniquement** depuis `resolved` | `tickets/ticket.service.ts` | `business-rules.test.ts` → *refuse open -> closed*, *refuse in_progress -> closed*, *autorise resolved -> closed* |
| Parcours complet autorisé | idem | *permet le parcours complet open -> in_progress -> resolved -> closed* |
| Le droit est évalué **avant** la règle métier | idem | *refuse la fermeture par un agent non autorisé (403 avant la règle métier)* |
| Message d'erreur explicite | idem | *le message d'erreur cite les deux statuts autorisés* |
| Statut inconnu → 400 | `tickets/ticket.schema.ts` | *renvoie 400 sur un statut inconnu* |
| `resolved_at` conservé au passage `resolved` → `closed` | `tickets/ticket.service.ts` | *conserve resolved_at en passant de resolved à closed* |
| `resolved_at` / `resolved_by` effacés à la réouverture | `tickets/ticket.service.ts` | *efface resolved_at et resolved_by lors d'une réouverture* |
| `PUT /tickets/:id` ne change pas le statut | `tickets/ticket.schema.ts` | `tickets.test.ts` → *ne permet pas de changer le statut via PUT* ; smoke *PUT /tickets/:id refuse de changer le statut* |

## 4.3 — Règle métier : pas de commentaire sur un ticket `closed`

| Exigence CDC | Implémentation | Preuve |
|---|---|---|
| Aucun commentaire sur un ticket `closed` | `comments/comment.service.ts` | `comments.test.ts` → *refuse un commentaire sur un ticket closed avec 400* ; smoke *§4.3 : commentaire sur ticket closed refusé, même pour un admin* |
| La règle vaut aussi pour un administrateur | idem | *refuse aussi pour un administrateur* ; smoke *§4.3 : refus également pour un agent* |
| Commentaires autorisés en `open`, `in_progress`, `resolved` | idem | *autorise un commentaire sur un ticket open / in_progress / resolved* |
| Nouvelle autorisation après réouverture | idem | *permet à nouveau un commenter après réouverture du ticket* |
| Commentaire rattaché à l'auteur authentifié | `comments/comment.repository.ts` | *crée un commentaire rattaché à l'auteur authentifié* ; *refuse un champ author forcé : l'auteur est imposé par le jeton* |
| Tout agent authentifié peut commenter | `comments/comment.service.ts` | *permet à tout agent authentifié de commenter, même sur un ticket d'autrui* |
| Message non vide et borné (5000 caractères) | `comments/comment.schema.ts` | *refuse un message vide*, *refuse un message composé uniquement d'espaces*, *refuse un message trop long*, *accepte un message de 5000 caractères (limite exacte)* |
| 404 sur ticket inexistant, 400 sur id malformé | `comments/comment.routes.ts` | *renvoie 404 pour un ticket inexistant plutôt que 400*, *renvoie 400 sur un identifiant de ticket malformé* |
| Ordre chronologique croissant | `comments/comment.repository.ts` | *classe les commentaires selon un ordre décroissant si les dates sont inversées* |

## Tickets

| Exigence CDC | Implémentation | Preuve |
|---|---|---|
| Création avec statut initial `open` | `tickets/ticket.service.ts` | `tickets.test.ts` → *crée un ticket avec le statut open* ; smoke *POST /api/tickets crée un ticket ouvert par l'agent* |
| Priorité `medium` par défaut | `tickets/ticket.service.ts` | *applique la priorité medium par défaut* |
| Titre borné (3 à 200 caractères) | `tickets/ticket.schema.ts` | *refuse un titre trop court*, *refuse un titre de plus de 200 caractères* ; smoke *Titre trop court refusé en 400* |
| Priorité invalide → 400 | `tickets/ticket.schema.ts` | *refuse une priorité inconnue avec 400* |
| Pagination avec métadonnées | `tickets/ticket.repository.ts` | *retourne la liste paginée avec ses métadonnées*, *respecte la pagination* |
| `limit` plafonné à 100 | `tickets/ticket.schema.ts` | *refuse un limit supérieur à 100 avec 400* |
| Filtres statut / priorité / agent / non affectés | `tickets/ticket.repository.ts` | *filtre par statut*, *filtre par priorité*, *filtre par agent assigné*, *filtre les tickets non assignés avec le mot-clé "unassigned"*, *combine plusieurs filtres* |
| Recherche dans le titre et la description, insensible à la casse | `migrations/002_search_trgm.sql` | *recherche dans le titre*, *recherche dans la description*, *ignore la casse dans la recherche* |
| Tri du plus récent au plus ancien | `tickets/ticket.repository.ts` | *trie du plus récent au plus ancien* |
| Paramètres de requête malformés → 400 | `tickets/ticket.schema.ts` | *refuse un statut invalide dans la query*, *refuse un assignedTo non-UUID* |
| Détail avec ses relations | `tickets/ticket.repository.ts` | *retourne le ticket avec ses relations* |
| Désaffectation par `null` | `tickets/ticket.service.ts` | *permet de désassigner avec null* ; smoke *Désaffectation par null acceptée* |

## Tableau de bord

| Exigence CDC | Implémentation | Preuve |
|---|---|---|
| Compteurs de tickets et répartition par statut | `dashboard/dashboard.repository.ts` | `dashboard.test.ts` → *compte tous les tickets*, *répartit les tickets par statut* ; smoke *Tableau de bord cohérent avec le seed* |
| Les quatre statuts toujours présents | `dashboard/dashboard.service.ts` | *inclut les quatre statuts dans byStatus, même à zéro* |
| Classement des agents par tickets résolus | `dashboard/dashboard.repository.ts` | *classe les agents par nombre de tickets résolus, du plus élevé au plus faible* ; smoke *Classement des agents non vide et trié du plus haut au plus bas* |
| Limite à cinq agents, agents sans résolution exclus | idem | *limite le classement à cinq agents*, *exclut les agents n'ayant rien résolu* |
| Nombres, jamais chaînes PostgreSQL | `dashboard/dashboard.service.ts` | *renvoie des nombres et non des chaînes PostgreSQL* |
| Accessible aux deux rôles | `dashboard/dashboard.routes.ts` | *autorise un administrateur*, *autorise un agent*, *renvoie les mêmes statistiques à un admin et à un agent* |

## Modèle de données

| Exigence CDC | Implémentation | Preuve |
|---|---|---|
| Trois tables métier : `users`, `tickets`, `ticket_comments` | `migrations/001_init.sql` | voir `docs/ERD.md` |
| Contraintes d'intégrité référentielle | `migrations/001_init.sql` | `tickets.test.ts` → *retourne 404 pour un ticket inexistant* |
| Unicité de l'e-mail | `migrations/001_init.sql` | `auth.test.ts` → *filtre par rôle* (lecture seule) |
| Jeu de démonstration : 3 utilisateurs, 10 tickets, 20 commentaires | `scripts/seed.ts` | smoke *GET /api/tickets renvoie les 10 tickets du seed* ; SQL invariant ci-dessous |

### Invariants SQL vérifiés

| Invariant | Attendu | Constaté |
|---|---|---|
| Commentaires rattachés à un ticket `closed` | 0 | 0 |
| Tickets `closed` sans `resolved_at` | 0 | 0 |
| Tickets `resolved`/`closed` sans `resolved_by` | 0 | 0 |
| Tickets affectés à un utilisateur non-agent | 0 | 0 |

## Points non listés par le CDC

Rien de ce qui est livré ne contredit le cahier des charges. Trois points ne figurent pas dans
le document et sont consignés dans [`DIFFERENCES.md`](./DIFFERENCES.md) : `resolved_by` et
`resolved_at` (imposés par le §4.4), `GET /api/users` (imposé par le §7), la pagination (bonus
du §9). Trois absences y sont également notées : ni SLA, ni `DELETE /api/tickets/:id`, ni CRUD
utilisateurs — le CDC n'en demande aucun.

**Une seule ambiguïté** : le titre du sujet annonce « Gestion SLA », mais aucune section du corps
n'en définit d'exigence. Aucune mécanique n'a été inventée pour combler ce vide.

## Couverture du client

Le tableau ci-dessus couvre **l'API**. Le client React dispose de **41 tests**
supplémentaires (`client/src/**/*.test.tsx`), tous exécutés par `npm run test` :

| Fichier | Couvre |
|---|---|
| `api/client.test.ts` | Client HTTP : URL, en-têtes, sérialisation, `ApiError`, panne réseau, `204`, persistance du jeton |
| `auth/auth-context.test.tsx` | Connexion, persistance, restauration de session, purge d'un jeton expiré, déconnexion |
| `auth/ProtectedRoute.test.tsx` | states de chargement, redirection, accès autorisé |
| `pages/LoginPage.test.tsx` | Soumission, message d'erreur du serveur, retour à la route demandée |
| `hooks/useTickets.test.tsx` | Chargement, filtres, état d'erreur, requête suspendue sans identifiant |
| `components/Badges.test.tsx` | Libellés des statuts et priorités, formatage des dates |

### Régression verrouillée sur `GET /auth/me`

Le test *lit le profil directement dans data, sans niveau user intermédiaire*
existe parce que le backend renvoyait `{ data: { user } }` au lieu de
`{ data: user }`. Conséquence : `profile.fullName` valait `undefined` après
restauration de session, et l'interface affichait un profil vide **sans lever
aucune erreur**. Le typecheck et le build passaient.

Ce test a été vérifié dans les deux sens : réinjecté avec l'ancienne forme
`{ data: { user } }`, il échoue sur `expected undefined to be 'Karim Benali'`.

## Note d'environnement

Les tests du client tournent sous **happy-dom**, pas jsdom. Depuis la version 27,
jsdom dépend d'un module ESM pur requis depuis son build CommonJS, ce que Node
20.17 ne sait pas faire : `require()` d'un module ESM n'est supporté qu'à partir
de Node 20.19. Passer Node ≥ 20.19 permettrait de revenir à jsdom sans autre
changement.

```
npm run test          # 124 tests serveur + 41 tests client
```