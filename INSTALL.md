# Installation

Guide de démarrage en 6 étapes. Le [README](./README.md) contient la référence complète
(architecture, endpoints, règles métier, tests).

## Prérequis

| Outil      | Version                            |
| ---------- | ---------------------------------- |
| Node.js    | `^20.19 \|\| ^22.13 \|\| >=24`     |
| npm        | ≥ 10                               |
| PostgreSQL | ≥ 14                               |

La borne `20.19` n'est pas arbitraire : elle est exigée par la chaîne Tailwind 4
(`@csstools/*`) et par `eslint`. Un Node 20.17 installe le projet mais émet un
`EBADENGINE` à chaque installation.

Node 21 est exclu : `vitest` ne le supporte pas. Avec `nvm`, un `.nvmrc` est fourni —
`nvm use`.

## 1. Base de données

Choisissez **un** des deux chemins. Ni l'un ni l'autre n'est obligatoire si vous avez déjà
un PostgreSQL joignable sur `localhost:5432`.

### Option A — Docker

```bash
docker compose up -d
```

Le conteneur fournit le serveur **seul**. Le schéma n'est pas créé au démarrage : c'est
fait à l'étape 3. C'est volontaire, pour que migrations et test share la même source de
vérité.

### Option B — PostgreSQL local

Installer PostgreSQL 14 ou plus, puis démarrer le service. Sous Windows :

```powershell
Get-Service postgresql-x64-*
```

Les deux bases sont créées à l'étape 3 — rien à faire ici.

## 2. Variables d'environnement

```bash
cp server/.env.example server/.env
```

Sous Windows PowerShell :

```powershell
Copy-Item server/.env.example server/.env
```

Adaptez `DATABASE_URL` et `TEST_DATABASE_URL` à vos identifiants. Les valeurs de
l'exemple correspondent au conteneur Docker par défaut.

`JWT_SECRET` est un placeholder : il fonctionne pour un test local, mais à remplacer en
production.

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

L'application **refuse de démarrer** si une variable requise manque, plutôt que d'échouer
plus tard sur une requête.

## 3. Dépendances et données

```bash
npm install
npm run setup
```

`npm run setup` enchaîne trois étapes, chacune disponible séparément :

| Étape          | Effet                                                            |
| -------------- | ---------------------------------------------------------------- |
| `db:create`    | Crée `helpdeskpro` et `helpdeskpro_test` si absentes              |
| `db:migrate`   | Applique les migrations non encore enregistrées, par ordre        |
| `db:seed`      | 3 utilisateurs, 10 tickets, 20 commentaires                       |

`setup` est idempotent : le relancer ne casse rien. `db:seed` réinitialise les tables via
`TRUNCATE`.

## 4. Démarrage

```bash
npm run dev
```

- API : <http://localhost:5000>
- Interface : <http://localhost:5173>
- Swagger : <http://localhost:5000/api/docs>

Vite proxifie `/api` vers l'API : aucune configuration CORS n'est nécessaire en
développement.

## 5. Se connecter

| Rôle  | Email                          | Mot de passe     |
| ----- | ------------------------------ | ---------------- |
| Admin | `admin@helpdeskpro.com`        | `Password123!`   |
| Agent | `karim.benali@helpdeskpro.com` | `Password123!`   |
| Agent | `sofia.marchand@helpdeskpro.com`| `Password123!`  |

## 6. Vérifier l'installation

```bash
npm run verify
```

Enchaîne lint, typecheck, 165 tests et le build des deux applications.

Pour un test de bout en bout contre une instance en cours d'exécution :

```bash
npm run smoke
```

29 vérifications sur l'API réelle. **Attention** : le smoke test crée 2 tickets
supplémentaires. Pour revenir au jeu de données d'origine :

```bash
npm run db:seed
```

## Dépannage

**`ECONNREFUSED 127.0.0.1:5432`** — PostgreSQL n'écoute pas. Avec Docker :
`docker compose up -d`. Sinon vérifiez le service, puis `DATABASE_URL`.

**`password authentication failed`** — l'utilisateur ou le mot de passe ne correspond
pas à `DATABASE_URL`. Avec Docker, l'utilisateur est `postgres` et le mot de passe
`Helpdesk2026!` comme dans `docker-compose.yml`.

**`database "helpdeskpro" does not exist`** — `npm run db:create` n'a pas été lancé.
Utilisez `npm run setup`, qui enchaîne tout.

**`relation "tickets" does not exist`** — la base existe mais le schéma non.
`npm run db:migrate`.

**`JWT_SECRET` manquant au démarrage** — `server/.env` absent ou incomplet. Voir étape 2.

**Un test échoue sur `happy-dom` ou un module ESM** — version de Node hors de la plage
supportée. `node --version` puis `nvm use`.

**Port 5000 ou 5173 déjà utilisé** — un autre processus occupe le port. Changez `PORT`
dans `server/.env`, ou arrêtez le processus concerné.

## Commandes utiles

| Commande                | Effet                                       |
| ----------------------- | ------------------------------------------- |
| `npm run setup`         | Bases + migrations + seed                   |
| `npm run dev`           | API et interface en mode développement      |
| `npm run verify`        | lint + typecheck + tests + build            |
| `npm run smoke`         | 29 vérifications bout-en-bout               |
| `npm run db:reset`      | Réinitialise la base de développement       |
| `npm run db:reset:test` | Réinitialise la base de test                |
| `npm run openapi`       | Régénère `docs/openapi.yaml`                |