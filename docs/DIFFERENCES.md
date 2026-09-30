# Écarts par rapport au cahier des charges

Le cahier des charges est la spécification de référence. Ce document liste, sans enjoliver, tout
ce qui n'y figure pas ou s'en écarte. Ce qui n'est pas listé ici est un bug, pas une
interprétation.

**Aucune exigence du CDC n'est en échec.** Les 9 sections et 82 exigences ont été vérifiées une à
une contre le code ; le détail des preuves est dans [`CONFORMITE.md`](./CONFORMITE.md).

## Points non listés par le CDC

Aucun des trois points ci-dessous n'est une divergence fonctionnelle : ce sont des ajouts ou des
absences que le CDC laisse ouverts. Ils sont consignés pour que rien ne soit caché.

### 1. `resolved_by` et `resolved_at` sur `tickets`

**Ajout rendu nécessaire par une exigence du CDC.**

Le §4.2 liste les champs « minimum » d'un ticket et n'y mentionne pas ces deux colonnes.
Mais le §4.4 exige d'afficher le « top 5 des agents ayant résolu le plus de tickets » :

- sans `resolved_by`, impossible de savoir *qui* a résolu — on ne pourrait afficher qu'un
  compteur global, pas un classement ;
- sans `resolved_at`, impossible de dater la résolution.

L'exigence est donc inatteignable avec les seuls champs listés au §4.2. La requête de
classement fait `INNER JOIN users u ON u.id = t.resolved_by`.

`resolved_at` est contraint par un `CHECK` : un ticket `resolved` ou `closed` doit l'avoir,
un ticket `open` ou `in_progress` ne doit pas. Sans cette contrainte, la colonne serait
incohérente au premier `UPDATE` manual.

### 2. `GET /api/users`

**Ajout rendu nécessaire par une exigence du CDC.**

Le §4.1 et le §6 listent les endpoints « minimum » et n'incluent pas d'énumération des
utilisateurs. Mais le §7 exige l'action « assign », et le §4.2 impose
`PATCH /api/tickets/:id/assign` prenant un `assignedTo`. Proposer un choix suppose de connaître
la liste des agents, qu'aucun endpoint ne fournit.

`GET /api/users` retourne la liste publique — `id`, `email`, `full_name`, `role`, jamais
`password_hash`.

Un filtre `?role=agent` est accepté et sert le sélecteur d'affectation.

### 3. Pagination sur `GET /api/tickets`

**Ajout explicitement demandé par le CDC, en bonus (§9).**

Le §9 liste « Pagination sur liste tickets » parmi les bonus facultatifs. Sans elle, la liste
renverrait tous les tickets : la mémoire et le temps de réponse croîtraient linéairement.

`page` et `limit` (`limit` plafonné à 100) sont acceptés, et la réponse inclut :

```json
{ "data": [...], "meta": { "page": 1, "limit": 20, "total": 10, "totalPages": 1 } }
```

L'ordre de tri est fixé : **plus récent d'abord**. Le CDC ne définit ni `sort` ni `order`, et
aucun paramètre de tri n'est exposé.

## Absences

Aucun des points ci-dessous n'est exigé par le CDC : ils sont listés pour lever toute ambiguïté.

### 1. Aucun `DELETE /api/tickets/:id`

Le CDC énumère les endpoints d'un ticket. La suppression n'y figure pas : elle n'est pas
implémentée. Un ticket se clôt via `PATCH /api/tickets/:id/status`, ce qui préserve
l'historique — cohérent avec un outil de support.

### 2. Aucun CRUD utilisateurs

Seuls `POST /api/auth/login`, `GET /api/auth/me` et `GET /api/users` existent. Ni création, ni
modification, ni suppression d'utilisateur. Le CDC ne les définit pas.

En conséquence, `password_hash` n'est modifiable par aucun chemin applicatif : un mot de passe
ne peut être changé que directement en base.

## Conformité confirmée par le CDC

Ces points avaient été consignés comme des écarts avant que le cahier des charges ne soit
consulté. Le texte du CDC les confirme : ils sont donc reclassés en conformité.

### Aucun commentaire automatique de changement de statut

Une première version écrivait un commentaire système à chaque `PATCH /api/tickets/:id/status`,
pour tracer l'historique. **Cela a été retiré**, et le CDC justifie ce retrait :

- le §4.3 ne définit un commentaire que par `POST /api/tickets/:id/comments`. Aucune écriture
  automatique n'est décrite nulle part ;
- un commentaire inséré au moment de la fermeture aurait contourné la règle du §4.3 — interdire
  d'ajouter un commentaire à un ticket `closed` — que l'application venait d'appliquer.

Un champ `comment` optionnel avait également été ajouté à la charge utile de
`PATCH /api/tickets/:id/status`. **Le §6 ne le mentionne pas.** Il a été retiré : les schémas de
corps sont en mode `strict`, donc un champ non documenté est rejeté en `400` plutôt que
silencieusement ignoré. L'historique passe uniquement par `POST /api/tickets/:id/comments`,
qui refuse les tickets `closed`.

### Absence de mécanisme de SLA

**Le titre du sujet annonce « Gestion SLA », mais aucune section du corps n'en définit
d'exigence** : ni source du délai, ni seuil par priorité, ni comportement à dépassement. Le
§4.4 ne demande que quatre indicateurs, aucun lié au SLA.

Aucun SLA n'est donc implémenté : en inventer un serait un écart bien plus grave que son absence.
Si la notion est réellement attendue, elle nécessite une spécification. **C'est la seule
ambiguïté du document.**

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
que la règle métier du §4.2. Toutes les transitions entre statuts sont donc permises, sauf
`closed` depuis un statut autre que `resolved`. Cela autorise la réouverture d'un ticket résolu
ou fermé, et une résolution répétée.

**Cascade de suppression.** `ON DELETE CASCADE` entre `ticket_comments` et `tickets`, `RESTRICT`
sur `created_by` et `author_id`, `SET NULL` sur `assigned_to` et `resolved_by`. Ce sont des choix
de robustesse pour la suppression d'un utilisateur ; aucun endpoint de suppression n'étant
exposé, ils ne sont atteignables qu'en SQL direct.

**`GET /api/health` et `GET /api/docs`.** Deux endpoints hors CDC : une sonde de disponibilité
utilisée par `docker-compose` et le dashboard, et une interface Swagger. Sans impact fonctionnel.

## Points de conformité vérifiés

| Exigence                                              | État                                        |
| ----------------------------------------------------- | ------------------------------------------- |
| §4.2 — `closed` uniquement depuis `resolved`          | Implémentée et couverte par 9 tests         |
| §4.3 — pas de commentaire sur un ticket `closed`      | Implémentée et couverte par 9 tests         |
| Statut modifié uniquement par `PATCH /:id/status`     | `PUT /:id` rejette `status` en `400`        |
| Mots de passe hachés en bcrypt                        | Coût 12 en développement, jamais renvoyé    |
| Enveloppes d'erreur normalisées                       | `400` / `401` / `403` / `404` / `409` / `500` |
| Requêtes paramétrées                                  | Aucune interpolation de valeur en SQL       |