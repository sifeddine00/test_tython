# Écarts par rapport au cahier des charges

Le cahier des charges est la spécification de référence. Ce document liste, sans enjoliver, ce
qui s'en écarte et pourquoi. Tout écart non listé ici est un bug, pas une interprétation.

## Écarts assumés

### 1. `resolved_by` et `resolved_at` sur `tickets`

**Ajout, non prévu par le CDC.**

Le CDC décrit une table `tickets` sans ces deux colonnes. Elles sont ajoutées pour deux
raisons :

- le tableau de bord exige un « top 5 des agents ayant résolu le plus de tickets ». Sans
  `resolved_by`, il est impossible de savoir *qui* a résolu : on ne connaîtrait que le
  compteur global, pas le classement ;
- `resolved_at` matérialise la date de résolution, seule information permettant de dater la
  clôture d'une résolution.

`resolved_at` est contraint par un `CHECK` : un ticket `resolved` ou `closed` doit l'avoir,
un ticket `open` ou `in_progress` ne doit pas. Sans cette contrainte, la colonne serait
incohérente au premier `UPDATE` manual.

### 2. `GET /api/users`

**Ajout, non prévu par le CDC.**

L'affectation de ticket (`PATCH /api/tickets/:id/assign`) prend un `assignedTo`. L'interface a
besoin de la liste des agents pour proposer un choix, et il n'existe aucun endpoint
d'énumération des utilisateurs. `GET /api/users` retourne la liste publique — `id`, `email`,
`full_name`, `role`, jamais `password_hash`.

Un filtre `?role=agent` est accepté et sert le sélecteur d'affectation.

### 3. Pagination sur `GET /api/tickets`

**Ajout, non prévu par le CDC.**

Sans pagination, la liste renvoie tous les tickets. Le jeu de démonstration en contient dix,
mais la requête n'aurait aucune limite : la mémoire et le temps de réponse croîtraient
linéairement.

`page` et `limit` (`limit` plafonné à 100) sont acceptés, et la réponse inclut :

```json
{ "data": [...], "meta": { "page": 1, "limit": 20, "total": 10, "totalPages": 1 } }
```

L'ordre de tri est fixé : **plus récent d'abord**. Le CDC ne définit ni `sort` ni `order`, et
aucun paramètre de tri n'est exposé.

## Écarts par absence

### 4. Aucun mécanisme de SLA

Le titre de la section 4 du CDC évoque un « suivi du SLA », mais **aucune exigence SLA n'existe
dans le corps du document** : ni calcul de délai, ni compte à rebours, ni alerte, ni violation.

Aucun SLA n'est donc implémenté. L'inventer aurait constitué un écart bien plus grave que son
absence. Si la notion est réellement attendue, elle nécessite une spécification : source du
délai (heures ouvrées ou calendaires), seuils par priorité, comportement à dépassement.

### 5. Aucun `DELETE /api/tickets/:id`

Le CDC énumère les endpoints d'un ticket. La suppression n'y figure pas : elle n'est pas
implémentée. Un ticket se clôt via `PATCH /api/tickets/:id/status`, ce qui préserve
l'historique — cohérent avec un outil de support.

### 6. Aucun CRUD utilisateurs

Seuls `POST /api/auth/login`, `GET /api/auth/me` et `GET /api/users` existent. Ni création, ni
modification, ni suppression d'utilisateur. Le CDC ne les définit pas.

En conséquence, `password_hash` n'est modifiable par aucun chemin applicatif : un mot de passe
ne peut être changé que directement en base.

### 7. Aucun commentaire automatique de changement de statut

Une première version écrivait un commentaire système à chaque `PATCH /api/tickets/:id/status`,
pour tracer l'historique. **Cela a été retiré**, pour deux raisons :

- la règle 4.3 interdit d'ajouter un commentaire à un ticket `closed`. Écrire une ligne dans
  `ticket_comments` au moment de la fermeture revenait à contourner cette règle que
  l'application vient d'appliquer ;
- le CDC ne définit aucun champ `comment` sur cette route.

Un champ `comment` optionnel avait également été ajouté à la charge utile de
`PATCH /api/tickets/:id/status`. Il a été retiré : les schémas de corps sont en mode `strict`,
donc un champ non documenté est rejeté en `400` plutôt que silencieusement ignoré. L'historique
passe uniquement par `POST /api/tickets/:id/comments`, qui refuse les tickets `closed`.

## Précisions d'implémentation

Ces points ne sont pas des écarts : le CDC est muet, et le choix est documenté pour être
discutable.

**Comparaison de casse des e-mails.** L'unicité porte sur `lower(email)` : `Admin@x.com` et
`admin@x.com` désignent le même compte. Une contrainte d'unicité simple aurait refusé le second
insert.

**`assignedTo = null` désassigne.** Le CDC décrit l'affectation à un agent sans préciser le
déassignement. `null` le rend explicite plutôt que de dépendre de l'absence du champ.

**Filtre `assignedTo=unassigned`.** Le CDC liste `assignedTo` comme filtre de liste. Un mot-clé
`unassigned` a été ajouté dans ce même paramètre, pour éviter d'introduire un second nom de
paramètre — les valeurs restent des identifiants dans tous les autres cas.

**Un agent peut commenter n'importe quel ticket.** La restriction « auteur ou assigné » du CDC
porte sur la *modification* d'un ticket. Les commentaires ouvrent le dialogue : les restreindre
aurait empêché un agent de répondre sur un ticket pris en charge par un collègue.

**Le rôle de l'assigné est vérifié.** `assignTicket` refuse une cible qui n'est pas `agent`
(`400`), y compris un administrateur. Le CDC ne l'énonce pas, mais affecter un ticket à un
compte qui ne traite pas de tickets n'aurait pas de sens.

**Reprise d'un ticket `resolved` vers `closed`.** Le CDC n'énumère pas les transitions autres
que la règle 4.2. Toutes les transitions entre statuts sont donc permises, sauf
`closed` depuis un statut autre que `resolved`. Cela autorise la réouverture d'un ticket résolu
ou fermé, et une résolution repeated.

**Cascade de suppression.** `ON DELETE CASCADE` entre `ticket_comments` et `tickets`, `RESTRICT`
sur `created_by` et `author_id`, `SET NULL` sur `assigned_to` et `resolved_by`. Ce sont des choix
de robustesse pour la suppression d'un utilisateur ; aucun endpoint de suppression n'étant
exposé, ils ne sont atteignables qu'en SQL direct.

**`GET /api/health` et `GET /api/docs`.** Deux endpoints hors CDC : une sonde de disponibilité
utilisée par `docker-compose` et le dashboard, et une interface Swagger. Sans impact fonctionnel.

## Points de conformité vérifiés

| Exigence                                              | État                                        |
| ----------------------------------------------------- | ------------------------------------------- |
| 4.2 — `closed` uniquement depuis `resolved`          | Implémentée et couverte par 9 tests         |
| 4.3 — pas de commentaire sur un ticket `closed`      | Implémentée et couverte par 9 tests         |
| Statut modifié uniquement par `PATCH /:id/status`     | `PUT /:id` rejette `status` en `400`        |
| Mots de passe hachés en bcrypt                        | Coût 12 en développement, jamais renvoyé    |
| Enveloppes d'erreur normalisées                       | `400` / `401` / `403` / `404` / `409` / `500` |
| Requêtes paramétrées                                  | Aucune interpolation de valeur en SQL       |