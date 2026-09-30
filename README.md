# HelpDeskPro

Système de gestion de tickets de support interne — **PERN** (PostgreSQL, Express, React, Node).

Suivi des tickets depuis la création jusqu'à la clôture, avec commentaires de suivi,
répartition par agent, affectation et tableau de bord. L'implémentation suit le cahier des
charges. Les 82 exigences du cahier des charges sont vérifiées une à une dans
[`docs/CONFORMITE.md`](docs/CONFORMITE.md) ; les points que le CDC ne mentionne pas sont listés
dans [`docs/DIFFERENCES.md`](docs/DIFFERENCES.md).

## Sommaire

- [Architecture](#architecture)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Variables d'environnement](#variables-denvironnement)
- [Comptes de démonstration](#comptes-de-démonstration)
- [Commandes disponibles](#commandes-disponibles)
- [Endpoints](#endpoints)
- [Règles métier](#règles-métier)
- [Tests](#tests)
- [Documentation](#documentation)
- [Dépannage](#dépannage)

## Architecture

Deux workspaces npm, un dépôt unique.

```
helpdeskpro/
├── server/                  API REST — Express + PostgreSQL
│   ├── migrations/          SQL versionné, appliqué par un runner maison
│   ├── scripts/             create-db, migrate, seed, reset, openapi
│   ├── src/
│   │   ├── config/          variables d'environnement validées (Zod)
│   │   ├── db/              pool PostgreSQL et helpers de requête
│   │   ├── errors/          taxonomie d'erreurs typées
│   │   ├── middleware/      authentification, validation, gestion d'erreurs
│   │   ├── modules/         auth, users, tickets, comments, dashboard
│   │   ├── utils/           JWT, bcrypt, pagination
│   │   ├── app.ts           assemblage Express
│   │   ├── openapi.ts       spécification OpenAPI 3.0 (source unique)
│   │   ├── routes.ts        montage des routes
│   │   └── server.ts        point d'entrée
│   └── tests/               Vitest + Supertest
├── client/                  Interface — React 18 + Vite + Tailwind
│   └── src/
│       ├── api/             client HTTP typé et surface d'appel
│       ├── auth/            session et garde de route
│       ├── components/      badges, pagination, états, coquille applicative
│       ├── hooks/           hooks React Query
│       ├── lib/             libellés et formatage
│       └── pages/           connexion, tableau de bord, tickets
└── docs/                    ERD, écarts, OpenAPI
```

**Choix structurants**

- **SQL brut, sans ORM.** Le cahier des charges impose des requêtes lisibles et
  paramétrées. Un ORM aurait masqué la requête réelle et son plan d'exécution.
- **Contrôleur → service → repository.** Le SQL ne sort jamais du `repository`, les règles
  métier ne vivent que dans le `service`, et le `controller` ne fait que traduire HTTP.
- **Zod aux frontières.** Corps, query et paramètres sont validés avant d'atteindre la
  logique métier, avec un message d'erreur en français.
- **Un seul `Pool`.** Centralisé dans `db/pool.ts` ; aucun autre module n'en instancie un.

## Prérequis

| Outil      | Version                       | Remarque                                                          |
| ---------- | ----------------------------- | ----------------------------------------------------------------- |
| Node.js    | `^20.19 \|\| ^22.13 \|\| >=24` | Exigé par Tailwind 4 et `eslint` ; Node 21 refusé par `vitest`     |
| npm        | ≥ 10                          | Workspaces requis                                                 |
| PostgreSQL | ≥ 14 (16 pour Docker)         | `gen_random_uuid()` est natif depuis la 13, sans extension         |

Le fichier `.nvmrc` permet de sélectionner la bonne version avec `nvm use`.

> Pour une installation pas à pas, voir [`INSTALL.md`](INSTALL.md).

## Installation

### 1. Base de données

Avec Docker :

```bash
docker compose up -d
```

Sans Docker : une instance PostgreSQL locale ≥ 14 suffit. Les deux bases doivent exister :

```bash
npm run db:create
```

Ce script crée `helpdeskpro` et `helpdeskpro_test`. Il est idempotent : une base existante est
ignorée.

### 2. Variables d'environnement

```bash
cp server/.env.example server/.env
```

Puis renseignez `DATABASE_URL` et `TEST_DATABASE_URL`. L'application **refuse de démarrer**
si une variable requise manque, plutôt que d'échouer plus tard sur une requête.

### 3. Dépendances et schéma

```bash
npm install
npm run setup
```

`npm run setup` enchaîne `db:create`, `db:migrate` et `db:seed`. Les étapes restent
disponibles séparément.

``db:migrate` applique chaque fichier `NNN_nom.sql` encore absent de `schema_migrations`, dans
l'ordre lexicographique, chaque fichier dans une transaction. Un échec annule la migration sans
désynchroniser la table de suivi.

`db:seed` insère 3 utilisateurs, 10 tickets et 20 commentaires, répartis sur les quatre statuts.

### 4. Démarrage

```bash
npm run dev
```

Lance l'API sur `http://localhost:5000` et l'interface sur `http://localhost:5173`. Vite
proxifie `/api` vers l'API : aucune configuration CORS n'est nécessaire en développement.

## Variables d'environnement

Toutes validées par Zod au démarrage. Fichier : `server/.env`.

| Variable           | Requis | Défaut                 | Rôle                                              |
| ------------------ | ------ | ---------------------- | ------------------------------------------------- |
| `NODE_ENV`         | non    | `development`          | `development`, `test` ou `production`             |
| `PORT`             | non    | `5000`                 | Port d'écoute de l'API                           |
| `DATABASE_URL`     | **oui**| —                      | Base de développement                             |
| `TEST_DATABASE_URL`| **oui**| —                      | Base de tests — **jamais** la base de développement|
| `JWT_SECRET`       | **oui**| —                      | Clé HS256, 32 caractères minimum                  |
| `JWT_EXPIRES_IN`   | non    | `8h`                   | Durée de validité des jetons                      |
| `BCRYPT_ROUNDS`    | non    | `12`                   | Coût bcrypt, borné entre 10 et 15                 |
| `CORS_ORIGIN`      | non    | `http://localhost:5173`| Origines autorisées, séparées par des virgules    |
| `LOG_LEVEL`        | non    | `info`                 | `error`, `warn`, `info` ou `debug`                |

`server/.env` est ignoré par Git. `server/.env.example` fait foi.

## Comptes de démonstration

Mot de passe commun : `Password123!`

| Rôle  | E-mail                        |
| ----- | ----------------------------- |
| admin | admin@helpdeskpro.com         |
| agent | karim.benali@helpdeskpro.com  |
| agent | sofia.marchand@helpdeskpro.com|

Le jeu de démonstration contient 10 tickets répartis en 3 `open`, 2 `in_progress`,
3 `resolved` et 2 `closed`, ainsi que 20 commentaires — aucun sur un ticket `closed`.

## Commandes disponibles

Depuis la racine du dépôt.

| Commande                   | Effet                                                      |
| -------------------------- | ---------------------------------------------------------- |
| `npm run dev`              | API et interface en parallèle (`concurrently`)             |
| `npm run dev:server`       | API seule, avec rechargement à chaud                       |
| `npm run dev:client`       | Interface seule                                             |
| `npm run build`            | Compile l'API et l'interface                               |
| `npm start`                | Démarre l'API compilée (`dist/server.js`)                  |
| `npm test`                 | 124 tests API + 41 tests interface                         |
| `npm run lint`             | ESLint sur les deux workspaces                             |
| `npm run typecheck`        | `tsc --noEmit` sur l'API, l'interface et `scripts/`        |
| `npm run verify`           | `lint` + `typecheck` + `test` + `build`                    |
| `npm run smoke`            | Vérification bout-en-bout sur une API démarrée              |
| `npm run db:create`        | Crée les deux bases                                        |
| `npm run db:migrate`       | Applique les migrations en attente                         |
| `npm run db:seed`          | Insère le jeu de démonstration                             |
| `npm run db:reset`         | Vide le schéma de la base de développement                 |
| `npm run db:reset:test`    | Vide le schéma de la base de test                          |
| `npm run openapi`          | Régénère `docs/openapi.yaml` depuis `src/openapi.ts`        |

## Endpoints

Base : `/api`. Tous les endpoints sauf `POST /auth/login` et `GET /health` exigent un
en-tête `Authorization: Bearer <token>`.

| Méthode | Chemin                          | Rôle        | Accès                    |
| ------- | ------------------------------- | ----------- | ------------------------ |
| `POST`  | `/auth/login`                   | Connexion   | Public                    |
| `GET`   | `/auth/me`                      | Profil      | Authentifié              |
| `GET`   | `/users`                        | Liste       | Authentifié              |
| `POST`  | `/tickets`                      | Création    | Authentifié              |
| `GET`   | `/tickets`                      | Liste       | Authentifié              |
| `GET`   | `/tickets/:id`                  | Détail      | Authentifié              |
| `PUT`   | `/tickets/:id`                  | Modification| Auteur, assigné, admin   |
| `PATCH` | `/tickets/:id/status`           | Statut      | Auteur, assigné, admin   |
| `PATCH` | `/tickets/:id/assign`           | Affectation | Administrateur           |
| `GET`   | `/tickets/:id/comments`         | Commentaires| Authentifié              |
| `POST`  | `/tickets/:id/comments`         | Commentaire | Authentifié              |
| `GET`   | `/dashboard/stats`              | Statistiques| Authentifié              |
| `GET`   | `/health`                       | Sonde       | Public                    |

Filtres de `GET /tickets` : `status`, `priority`, `assignedTo` (identifiant ou `unassigned`),
`search`, `page`, `limit` (100 maximum). Le tri est fixé au plus récent d'abord.

Les enveloppes de réponse sont uniformes :

```json
{ "data": { }, "meta": { "page": 1, "limit": 20, "total": 10, "totalPages": 1 } }
```

et les erreurs :

```json
{ "error": { "code": "TICKET_INVALID_STATUS_TRANSITION", "message": "…", "details": [] } }
```

| Code | Signification                                                  |
| ---- | -------------------------------------------------------------- |
| 400  | Validation ou règle métier violée                               |
| 401  | Jeton absent, invalide ou expiré                                |
| 403  | Authentifié mais droits insuffisants                            |
| 404  | Ressource inexistante                                           |
| 409  | Conflit d'unicité en base                                       |
| 500  | Erreur interne — la pile n'est renvoyée qu'hors production      |

## Règles métier

### Un ticket ne se ferme que s'il est résolu

`PATCH /tickets/:id/status` avec `closed` n'aboutit que si le statut courant est `resolved`.
Sinon `400 TICKET_INVALID_STATUS_TRANSITION`. C'est la seule restriction de transition : toutes
les autres transitions sont permises, réouverture comprise.

### Pas de commentaire sur un ticket fermé

`POST /tickets/:id/comments` renvoie `400 COMMENT_ON_CLOSED_TICKET` si le ticket est `closed`,
pour tout rôle. Le ticket doit être rouvert pour recevoir de nouveau commentaires.

### Le statut ne se change que par sa route dédiée

`PUT /tickets/:id` rejette un corps contenant `status`. Les schémas de corps sont stricts : un
champ non documenté produit un `400` plutôt que d'être silencieusement ignoré.

### Droits sur les tickets

Tout agent authentifié voit **tous** les tickets. En revanche il ne peut en modifier un, ni
changer son statut, que s'il en est l'auteur ou l'agent assigné ; sinon `403`. L'administrateur
n'est pas restreint. Seul un administrateur affecte un ticket, et la cible doit être de rôle
`agent`.

## Tests

```bash
npm test
```

124 tests Vitest + Supertest, exécutés sur `helpdeskpro_test`. Le schéma de la base de test est
détruit et reconstruit avant chaque fichier, donc chaque exécution part d'un état identique et
le jeu de données de développement n'est jamais touché.

Le pool sélectionne la base selon `NODE_ENV` : en environnement `test` il pointe vers
`TEST_DATABASE_URL`. Sans cette bifurcation, la suite tronquerait la base de développement.

| Fichier                   | Couverture                                                        |
| ------------------------- | ----------------------------------------------------------------- |
| `auth.test.ts`            | Connexion, jeton, profil, énumération des utilisateurs              |
| `business-rules.test.ts`  | Règles 4.2 et 4.3, cohérence des informations de résolution         |
| `tickets.test.ts`         | CRUD, filtres, recherche, pagination, affectation, permissions     |
| `comments.test.ts`        | Création, lecture, validation du message, rattachement à l'auteur  |
| `dashboard.test.ts`       | Compteurs, répartition, top 5 des agents, contrôle d'accès          |

## Documentation

| Document                          | Contenu                                          |
| --------------------------------- | ------------------------------------------------ |
| [`INSTALL.md`](INSTALL.md)        | Installation pas à pas, en 6 étapes             |
| [`docs/CONFORMITE.md`](docs/CONFORMITE.md) | Tableau exigence par exigence, avec la preuve exécutable de chacune |
| [`docs/ERD.md`](docs/ERD.md)       | Schéma, contraintes, index, choix de conception   |
| [`docs/DIFFERENCES.md`](docs/DIFFERENCES.md) | Points que le CDC ne mentionne pas, et pourquoi |
| [`docs/openapi.yaml`](docs/openapi.yaml) | Spécification OpenAPI 3.0                    |

La spécification est également disponible en direct sur `http://localhost:5000/api/docs`
(Swagger UI) et au format JSON sur `/api/docs.json`.

## Dépannage

**`Configuration d'environnement invalide` au démarrage** — `server/.env` est absent ou
incomplet. Copiez `server/.env.example` et renseignez `DATABASE_URL`, `TEST_DATABASE_URL` et
`JWT_SECRET` (32 caractères minimum).

**`ECONNREFUSED 127.0.0.1:5432`** — PostgreSQL n'écoute pas. Avec Docker :
`docker compose up -d`. Sinon vérifiez le service Windows `postgresql-x64-16`.

**`password authentication failed for user "postgres"`** — l'utilisateur de la base n'est pas
le `postgres` du compte Windows. Ajustez `DATABASE_URL` au rôle réellement créé.

**Les tests échouent sur la connexion** — `helpdeskpro_test` n'existe pas :
`npm run db:create`.

**`error: relation "users" does not exist`** — les migrations n'ont pas été appliquées :
`npm run db:migrate`.

**`Cannot find module '../../scripts/...'`** — exécution des tests depuis le mauvais dossier.
Lancez `npm test` depuis la racine du dépôt.

**L'interface affiche « Impossible de joindre le serveur »** — l'API n'est pas démarrée, ou
n'écoute pas sur le port 5000. Le proxy Vite cible `http://localhost:5000`.

**Port 5000 déjà utilisé** — changez `PORT` dans `server/.env`, ainsi que la cible du proxy
dans `client/vite.config.ts`.