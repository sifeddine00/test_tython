import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAssignableUsers, useTicket, useTicketMutations } from '@/hooks/useTickets';
import { useCreateComment, useTicketComments } from '@/hooks/useComments';
import { PriorityBadge, StatusBadge } from '@/components/Badges';
import { ErrorState, InlineLoader, Spinner } from '@/components/Feedback';
import { useAuth } from '@/auth/useAuth';
import { PRIORITIES, PRIORITY_DESCRIPTORS, formatDateTime } from '@/lib/labels';
import type { TicketPriority, TicketStatus } from '@/api/types';

/**
 * Détail d'un ticket : informations, statut, affectation et commentaires.
 *
 * Trois règles du CDC sont matérialisées ici :
 *   - seul un administrateur affecte un ticket ;
 *   - un agent ne modifie que ses tickets ou ceux qui lui sont assignés ;
 *   - aucun commentaire n'est possible sur un ticket `closed`.
 *
 * Ces règles sont aussi appliquées côté serveur : les boutons sont désactivés
 * pour éviter une erreur, jamais pour s'y substituer.
 */

const STATUS_TRANSITIONS: Array<{ value: TicketStatus; label: string }> = [
  { value: 'open', label: 'Ouvrir' },
  { value: 'in_progress', label: 'Mettre en cours' },
  { value: 'resolved', label: 'Marquer résolu' },
  { value: 'closed', label: 'Fermer' },
];

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const ticketQuery = useTicket(id);
  const { updateStatus, assignTicket, updateTicket } = useTicketMutations(id);
  const usersQuery = useAssignableUsers();

  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<unknown>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    priority: 'medium' as TicketPriority,
  });

  const ticket = ticketQuery.data;

  if (ticketQuery.isPending) {
    return <InlineLoader label="Chargement du ticket…" />;
  }

  if (ticketQuery.isError || ticket === undefined) {
    return (
      <ErrorState
        error={ticketQuery.error}
        onRetry={() => void ticketQuery.refetch()}
        title="Ticket indisponible"
      />
    );
  }

  const isAdmin = user?.role === 'admin';
  const canModify =
    isAdmin === true ||
    ticket.createdBy.id === user?.id ||
    ticket.assignedTo?.id === user?.id;
  const isClosed = ticket.status === 'closed';

  const startEditing = () => {
    setEditForm({
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority,
    });
    setEditError(null);
    setIsEditing(true);
  };

  const handleEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEditError(null);

    try {
      await updateTicket.mutateAsync({
        ticketId: ticket.id,
        input: {
          title: editForm.title.trim(),
          description: editForm.description.trim(),
          priority: editForm.priority,
        },
      });
      setIsEditing(false);
    } catch (caught: unknown) {
      setEditError(caught);
    }
  };

  return (
    <div className="space-y-6">
      <Link to="/tickets" className="text-sm font-medium text-indigo-700 hover:underline">
        ← Retour aux tickets
      </Link>

      <article className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">{ticket.title}</h1>
              <p className="mt-1 text-xs text-slate-500">
                Créé par {ticket.createdBy.fullName} le {formatDateTime(ticket.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
            </div>
          </div>
        </header>

        <dl className="grid gap-4 border-b border-slate-200 px-6 py-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Assigné à
            </dt>
            <dd className="mt-1 text-slate-900">{ticket.assignedTo?.fullName ?? 'Non assigné'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Résolu par
            </dt>
            <dd className="mt-1 text-slate-900">{ticket.resolvedBy?.fullName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Résolu le
            </dt>
            <dd className="mt-1 text-slate-900">{formatDateTime(ticket.resolvedAt)}</dd>
          </div>
        </dl>

        <div className="px-6 py-5">
          {isEditing ? (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label htmlFor="edit-title" className="block text-sm font-medium text-slate-700">
                  Titre
                </label>
                <input
                  id="edit-title"
                  required
                  minLength={3}
                  maxLength={200}
                  value={editForm.title}
                  onChange={(event) =>
                    setEditForm((form) => ({ ...form, title: event.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-description"
                  className="block text-sm font-medium text-slate-700"
                >
                  Description
                </label>
                <textarea
                  id="edit-description"
                  required
                  minLength={5}
                  maxLength={5000}
                  rows={6}
                  value={editForm.description}
                  onChange={(event) =>
                    setEditForm((form) => ({ ...form, description: event.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-priority"
                  className="block text-sm font-medium text-slate-700"
                >
                  Priorité
                </label>
                <select
                  id="edit-priority"
                  value={editForm.priority}
                  onChange={(event) =>
                    setEditForm((form) => ({
                      ...form,
                      priority: event.target.value as TicketPriority,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  {PRIORITIES.map((value) => (
                    <option key={value} value={value}>
                      {PRIORITY_DESCRIPTORS[value].label}
                    </option>
                  ))}
                </select>
              </div>

              {editError !== null && <ErrorState error={editError} title="Modification refusée" />}

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={updateTicket.isPending}
                  className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {updateTicket.isPending ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          ) : (
            <>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {ticket.description}
              </p>
              {canModify && (
                <button
                  type="button"
                  onClick={startEditing}
                  className="mt-5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Modifier
                </button>
              )}
            </>
          )}
        </div>
      </article>

      <div className="grid gap-6 lg:grid-cols-2">
        <section
          aria-labelledby="status-heading"
          className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 id="status-heading" className="text-sm font-semibold text-slate-900">
            Changer le statut
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Un ticket ne peut être fermé que s'il est déjà résolu.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {STATUS_TRANSITIONS.map((transition) => {
              const isCurrent = transition.value === ticket.status;
              const closureForbidden =
                transition.value === 'closed' && ticket.status !== 'resolved';

              return (
                <button
                  key={transition.value}
                  type="button"
                  disabled={
                    !canModify || isCurrent || closureForbidden || updateStatus.isPending
                  }
                  onClick={() =>
                    void updateStatus
                      .mutateAsync({ ticketId: ticket.id, status: transition.value })
                      .catch(() => undefined)
                  }
                  title={
                    closureForbidden
                      ? 'Un ticket ne peut être fermé que depuis le statut « Résolu ».'
                      : undefined
                  }
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isCurrent ? `${transition.label} (actuel)` : transition.label}
                </button>
              );
            })}
          </div>

          {!canModify && (
            <p className="mt-3 text-xs text-amber-700">
              Seul l'auteur, l'agent assigné ou un administrateur peut changer le statut.
            </p>
          )}

          {updateStatus.isError && (
            <div className="mt-3">
              <ErrorState error={updateStatus.error} title="Changement de statut refusé" />
            </div>
          )}

          <div className="mt-6 border-t border-slate-100 pt-5">
            <label htmlFor="assign" className="block text-sm font-medium text-slate-700">
              Affecter à un agent
            </label>

            {isAdmin ? (
              <select
                id="assign"
                value={ticket.assignedTo?.id ?? ''}
                disabled={assignTicket.isPending}
                onChange={(event) => {
                  const value = event.target.value;
                  void assignTicket
                    .mutateAsync({ ticketId: ticket.id, assignedTo: value === '' ? null : value })
                    .catch(() => undefined);
                }}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-60"
              >
                <option value="">Non assigné</option>
                {usersQuery.data
                  ?.filter((candidate) => candidate.role === 'agent')
                  .map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.fullName} ({candidate.email})
                    </option>
                  ))}
              </select>
            ) : (
              <p className="mt-1 text-sm text-slate-500">
                Seuls les administrateurs peuvent affecter un ticket.
              </p>
            )}

            {assignTicket.isError && (
              <div className="mt-3">
                <ErrorState error={assignTicket.error} title="Affectation refusée" />
              </div>
            )}
          </div>
        </section>

        <CommentsSection ticketId={ticket.id} isClosed={isClosed} />
      </div>
    </div>
  );
}

/** Commentaires du ticket, isolés pour alléger le composant principal. */
function CommentsSection({ ticketId, isClosed }: { ticketId: string; isClosed: boolean }) {
  const { data: comments, isPending, isError, error, refetch } = useTicketComments(ticketId);
  const createComment = useCreateComment(ticketId);
  const [text, setText] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = text.trim();

    if (message === '') {
      return;
    }

    try {
      await createComment.mutateAsync(message);
      setText('');
    } catch {
      // Le message du backend s'affiche sous le champ.
    }
  };

  return (
    <section
      aria-labelledby="comments-heading"
      className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <h2 id="comments-heading" className="text-sm font-semibold text-slate-900">
          Commentaires
        </h2>
        {comments !== undefined && comments.length > 0 && (
          <span className="text-xs text-slate-500">{comments.length}</span>
        )}
      </div>

      <div className="mt-4 max-h-80 space-y-3 overflow-y-auto">
        {isPending ? (
          <InlineLoader label="Chargement des commentaires…" />
        ) : isError ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : (comments ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Aucun commentaire.</p>
        ) : (
          (comments ?? []).map((comment) => (
            <article key={comment.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <header className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{comment.author.fullName}</p>
                <time className="text-xs text-slate-500" dateTime={comment.createdAt}>
                  {formatDateTime(comment.createdAt)}
                </time>
              </header>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{comment.message}</p>
            </article>
          ))
        )}
      </div>

      {isClosed ? (
        <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Le ticket est fermé : aucun nouveau commentaire ne peut être ajouté.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-2 border-t border-slate-100 pt-4">
          <label htmlFor="comment" className="block text-sm font-medium text-slate-700">
            Ajouter un commentaire
          </label>
          <textarea
            id="comment"
            required
            minLength={1}
            maxLength={5000}
            rows={3}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Réponse, information complémentaire…"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />

          {createComment.isError && (
            <p
              role="alert"
              className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"
            >
              {createComment.error instanceof Error
                ? createComment.error.message
                : 'Le commentaire a été refusé.'}
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={createComment.isPending || text.trim().length === 0}
              className="flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {createComment.isPending && <Spinner className="h-3.5 w-3.5 text-white" />}
              Publier
            </button>
          </div>
        </form>
      )}
    </section>
  );
}