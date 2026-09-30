
-- -----------------------------------------------------------------------------
-- HelpDeskPro - Schéma de la base de données
-- PostgreSQL >= 14 (gen_random_uuid() est natif depuis PostgreSQL 13)
-- -----------------------------------------------------------------------------

-- =============================================================================
-- 1. Types énumérés
-- =============================================================================

CREATE TYPE user_role AS ENUM ('admin', 'agent');

CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');

CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high');

-- =============================================================================
-- 2. Trigger updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- =============================================================================
-- 3. Table users
-- =============================================================================

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Index UNIQUE sur lower(email) : la comparaison d'emails est
    -- insensible à la casse, sans dépendre de l'extension citext.
    email         VARCHAR(254) NOT NULL,
    full_name     VARCHAR(120) NOT NULL,
    password_hash TEXT NOT NULL,
    role          user_role NOT NULL DEFAULT 'agent',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT users_email_not_blank   CHECK (btrim(email) <> ''),
    CONSTRAINT users_email_format      CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    CONSTRAINT users_full_name_not_blank CHECK (btrim(full_name) <> '')
);

CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email));
CREATE INDEX users_role_idx ON users (role);

CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- 4. Table tickets
-- =============================================================================

CREATE TABLE tickets (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title        VARCHAR(200) NOT NULL,
    description  TEXT NOT NULL,
    priority     ticket_priority NOT NULL DEFAULT 'medium',
    status       ticket_status NOT NULL DEFAULT 'open',

    -- Auteur du ticket (obligatoire)
    created_by   UUID NOT NULL,
    -- Agent en charge du ticket (optionnel)
    assigned_to  UUID,
    -- Agent ayant effectué la résolution (piloté par l'application)
    resolved_by  UUID,
    resolved_at  TIMESTAMPTZ,

    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT tickets_created_by_fk
        FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT tickets_assigned_to_fk
        FOREIGN KEY (assigned_to) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT tickets_resolved_by_fk
        FOREIGN KEY (resolved_by) REFERENCES users (id) ON DELETE SET NULL,

    CONSTRAINT tickets_title_not_blank
        CHECK (btrim(title) <> ''),
    CONSTRAINT tickets_description_not_blank
        CHECK (btrim(description) <> ''),

    -- Cohérence entre le statut et les informations de résolution.
    -- Un ticket resolved/closed possède obligatoirement resolved_at et
    -- resolved_by ; un ticket open/in_progress n'en possède aucun.
    CONSTRAINT tickets_resolution_consistency
        CHECK (
            (status IN ('resolved', 'closed'))
            = (resolved_at IS NOT NULL AND resolved_by IS NOT NULL)
        )
);

-- Index ciblés sur les filtres du cahier des charges (section 4.2)
CREATE INDEX tickets_status_idx      ON tickets (status);
CREATE INDEX tickets_priority_idx    ON tickets (priority);
CREATE INDEX tickets_created_at_idx  ON tickets (created_at DESC);
CREATE INDEX tickets_assigned_to_idx ON tickets (assigned_to);
CREATE INDEX tickets_created_by_idx  ON tickets (created_by);

-- Index composite : couvre le tri par date d'un filtrage statut + priorité
CREATE INDEX tickets_status_priority_created_at_idx
    ON tickets (status, priority, created_at DESC);

CREATE TRIGGER tickets_set_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- 5. Table ticket_comments
-- =============================================================================

CREATE TABLE ticket_comments (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id  UUID NOT NULL,
    author_id  UUID NOT NULL,
    message    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- CASCADE : supprimer un ticket supprime son historique de commentaires
    CONSTRAINT ticket_comments_ticket_fk
        FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE CASCADE,
    -- RESTRICT : l'historique d'un auteur ne doit pas disparaître
    CONSTRAINT ticket_comments_author_fk
        FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE RESTRICT,

    CONSTRAINT ticket_comments_message_not_blank
        CHECK (btrim(message) <> '')
);

-- Historique d'un ticket, trié par date de création
CREATE INDEX ticket_comments_ticket_created_at_idx
    ON ticket_comments (ticket_id, created_at);

CREATE TRIGGER ticket_comments_set_updated_at
    BEFORE UPDATE ON ticket_comments
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
