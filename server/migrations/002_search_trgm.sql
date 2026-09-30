-- -----------------------------------------------------------------------------
-- HelpDeskPro - Index de recherche plein texte (section 4.2 du CDC)
--
-- Migration volontairement isolée : si l'extension pg_trgm est refusée par
-- l'hébergeur, l'application fonctionne toujours. Seule la recherche
-- full-text bascule sur un sequential scan au lieu d'un index lookup.
-- -----------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Index trigram GIN : accélère `title ILIKE '%terme%'`
CREATE INDEX tickets_title_trgm_idx
    ON tickets USING GIN (lower(title) gin_trgm_ops);

-- Index trigram GIN : accélère `description ILIKE '%terme%'`
CREATE INDEX tickets_description_trgm_idx
    ON tickets USING GIN (lower(description) gin_trgm_ops);
