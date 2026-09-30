import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTicketMutations } from '@/hooks/useTickets';
import { InlineError } from '@/components/Feedback';
import { PRIORITIES, PRIORITY_DESCRIPTORS } from '@/lib/labels';
import type { TicketPriority } from '@/api/types';

/**
 * Création de ticket — POST /api/tickets.
 *
 * Les contraintes de longueur dupliquées ici servent au retour immédiat dans
 * le formulaire ; le backend reste seul juge, ses messages remplacent ces
 * indications dès qu'une requête part.
 */
const TITLE_MAX = 200;
const DESCRIPTION_MAX = 5000;

export function TicketNewPage() {
  const navigate = useNavigate();
  const { createTicket } = useTicketMutations();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [error, setError] = useState<unknown>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      const ticket = await createTicket.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        priority,
      });
      navigate(`/tickets/${ticket.id}`, { replace: true });
    } catch (caught: unknown) {
      setError(caught);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Nouveau ticket</h1>
        <p className="mt-1 text-sm text-slate-500">
          Décrivez le problème rencontré. Le ticket sera créé avec le statut « Ouvert ».
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-slate-700">
            Titre <span className="text-rose-600">*</span>
          </label>
          <input
            id="title"
            name="title"
            required
            minLength={3}
            maxLength={TITLE_MAX}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Résumé court du problème"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <p className="mt-1 text-xs text-slate-500">
            Entre 3 et {TITLE_MAX} caractères. {title.trim().length}/{TITLE_MAX}
          </p>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-slate-700">
            Description <span className="text-rose-600">*</span>
          </label>
          <textarea
            id="description"
            name="description"
            required
            minLength={5}
            maxLength={DESCRIPTION_MAX}
            rows={8}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Étapes de reproduction, message d'erreur, comportement attendu…"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <p className="mt-1 text-xs text-slate-500">
            Au moins 5 caractères, {DESCRIPTION_MAX} maximum. {description.trim().length}/
            {DESCRIPTION_MAX}
          </p>
        </div>

        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-slate-700">
            Priorité
          </label>
          <select
            id="priority"
            name="priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value as TicketPriority)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            {PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {PRIORITY_DESCRIPTORS[value].label}
              </option>
            ))}
          </select>
        </div>

        <InlineError error={error} />

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={createTicket.isPending}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {createTicket.isPending ? 'Création…' : 'Créer le ticket'}
          </button>
        </div>
      </form>
    </div>
  );
}