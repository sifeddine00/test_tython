# Modèle de données — HelpDeskPro

Trois tables, deux énumérations, une fonction de mise à jour automatique. Le schéma est
créé par les migrations SQL de `server/migrations/` ; ce document en est la description,
pas une source de vérité parallèle.

## Diagramme

```
┌──────────────────────────────┐
│            users             │
├──────────────────────────────┤
│ PK  id           uuid        │  gen_random_uuid()
│     email        varchar(254)│  UNIQUE (lower(email))
│     full_name    varchar(120)│
│     password_hash text        │  bcrypt, jamais exposé
│     role         user_role    │  NOT NULL DEFAULT 'agent'
│     created_at   timestamptz  │  NOT NULL DEFAULT now()
│     updated_at   timestamptz  │  NOT NULL DEFAULT now()
└──────────────┬───────────────┘
               │
               │ users.id
       ┌───────┼───────────────┬────────────────┐
       │       │               │                │
       │ created_by        resolved_by      author_id
       │ (RESTRICT)         (SET NULL)       (RESTRICT)
       │       │               │                │
┌──────┴───────┴───────────────┴─┐   ┌────────┴──────────────────┐
│           tickets              │   │      ticket_comments       │
├────────────────────────────────┤   ├───────────────────────────┤
│ PK  id           uuid          │   │ PK  id        uuid         │
│     title        varchar(200)  │◄──┤     ticket_id  uuid         │
│     description  text           │1:N│     author_id  uuid         │
│     priority     ticket_priority│  │     message    text         │
│     status       ticket_status  │  │     created_at timestamptz  │
│     created_by   uuid           │  │     updated_at timestamptz  │
│     assigned_to  uuid  NULL     │  └───────────────────────────┘
│     resolved_by  uuid  NULL     │
│     resolved_at  timestamptz NULL│
│     created_at   timestamptz    │
│     updated_at   timestamptz    │
└────────────────────────────────┘
```

## Types énumérés

| Type             | Valeurs                                      |
| ---------------- | -------------------------------------------- |
| `user_role`      | `admin`, `agent`                             |
| `ticket_status`  | `open`, `in_progress`, `resolved`, `closed`  |
| `ticket_priority`| `low`, `medium`, `high`                      |

## Contraintes

### `users`

| Contrainte               | Règle                                                     |
| ------------------------ | --------------------------------------------------------- |
| `users_email_lower_key`  | Unicité insensible à la casse — deux agents ne peuvent pas partager une adresse |
| `users_email_format`     | Format `x@y.z` vérifié en base, pas seulement en API        |
| `users_full_name_not_blank` | Le nom ne peut pas être vide ou composé d'espaces       |
| `users_role_idx`         | Filtre par rôle pour `GET /api/users`                       |

### `tickets`

| Contrainte                     | Règle                                                              |
| ------------------------------ | ------------------------------------------------------------------ |
| `tickets_title_not_blank`      | `btrim(title) <> ''`                                               |
| `tickets_description_not_blank`| `btrim(description) <> ''`                                         |
| `tickets_created_by_fk`        | `ON DELETE RESTRICT` — un ticket a toujours un auteur               |
| `tickets_assigned_to_fk`       | `ON DELETE SET NULL` — l'agent disparaît, le ticket reste           |
| `tickets_resolved_by_fk`       | `ON DELETE SET NULL`                                               |
| `tickets_resolution_consistency` | `status IN ('resolved','closed')` implique `resolved_at IS NOT NULL` ; sinon `resolved_at IS NULL` |

`resolved_by` est laissé libre indépendamment de `resolved_at` : le CDC ne définit pas la
contrainte, et l'imposer ici rendrait impossible de résoudre un ticket dont l'agent a été
supprimé.

### `ticket_comments`

| Contrainte                            | Règle                                              |
| ------------------------------------- | -------------------------------------------------- |
| `ticket_comments_message_not_blank`   | `btrim(message) <> ''`                             |
| `ticket_comments_ticket_fk`           | `ON DELETE CASCADE`                                |
| `ticket_comments_author_fk`           | `ON DELETE RESTRICT`                               |

L'interdiction de commenter un ticket `closed` (règle 4.3) **n'est pas** une contrainte SQL :
elle dépend du workflow et vit dans `comment.service.ts`. La voir en base coûterait un
déclencheur qui pewrait à chaque insertion.

## Index

| Index                                        | Table              | Usage                                              |
| -------------------------------------------- | ------------------ | -------------------------------------------------- |
| `users_email_lower_key`                       | `users`            | Connexion par e-mail (`lower(email)`)              |
| `users_role_idx`                              | `users`            | `GET /api/users?role=`                             |
| `tickets_status_idx`                          | `tickets`          | Filtre par statut                                  |
| `tickets_priority_idx`                        | `tickets`          | Filtre par priorité                                |
| `tickets_created_by_idx`                      | `tickets`          | Filtrage par auteur                                |
| `tickets_assigned_to_idx`                     | `tickets`          | Filtre « mes tickets assignés »                    |
| `tickets_created_at_idx`                      | `tickets`          | Tri par date de création                           |
| `tickets_status_priority_created_at_idx`      | `tickets`          | Requête composée : filtre + tri                    |
| `tickets_title_trgm_idx`                      | `tickets`          | Recherche plein texte sur le titre (pg_trgm)        |
| `tickets_description_trgm_idx`                | `tickets`          | Recherche plein texte sur la description (pg_trgm)  |
| `ticket_comments_ticket_created_at_idx`       | `ticket_comments`  | Commentaires d'un ticket, triés chronologiquement   |

## Fonction `set_updated_at()`

Déclencheur `BEFORE UPDATE` sur `users`, `tickets` et `ticket_comments` : `updated_at` est
réaffecté à `now()` par la base et non par l'application. Un `UPDATE` écrit par psql ou par un
script de maintenance reste donc cohérent.

## Choix retenus

**`TIMESTAMPTZ` partout**, jamais `TIMESTAMP` : les dates sont stockées en UTC et rendues dans
le fuseau du lecteur. Le CDC ne précise pas le fuseau ; l'UTC évite les dates qui reculent
d'un jour au changement d'heure.

**`UUID` plutôt qu'`INTEGER`**: les identifiants ne sont pas devinables et un ticket peut être
créé hors de l'API sans coordination de séquence.

**`gen_random_uuid()`**: natif depuis PostgreSQL 13, le projet ne requiert donc que
PostgreSQL 14 ou plus, sans extension à installer.