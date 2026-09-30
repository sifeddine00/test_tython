-- -----------------------------------------------------------------------------
-- HelpDeskPro - Index de recherche plein texte (section 4.2 du CDC)
--
-- Migration applicative : elle n'est PAS exécutée par l'image Docker, qui ne
-- joue que les `.sql` placés à la racine de `/docker-entrypoint-initdb.d`. Seul
-- `npm run db:migrate` applique ce dossier, dans l'ordre lexicographique.
--
-- `pg_trgm` est fournie par défaut sur toute installation PostgreSQL standard.
-- Si un hébergeur la refuse, `db:migrate` s'arrête en erreur : la migration
-- étant transactionnelle, elle est annulée entièrement, `schema_migrations` reste
-- inchangée et aucun index n'est créé. L'application, elle, ne dépend pas de
-- l'extension — sans index, la recherche `ILIKE '%terme%'` passe en
-- sequential scan, plus lent mais correct.
-- -----------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Index trigram GIN : accélère `title ILIKE '%terme%'`
CREATE INDEX tickets_title_trgm_idx
    ON tickets USING GIN (lower(title) gin_trgm_ops);

-- Index trigram GIN : accélère `description ILIKE '%terme%'`
CREATE INDEX tickets_description_trgm_idx
    ON tickets USING GIN (lower(description) gin_trgm_ops);
