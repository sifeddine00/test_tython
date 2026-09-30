/**
 * Noms des statuts, libellés et couleurs.
 *
 * Centralisés ici pour que l'interface ne redéfinisse pas les mêmes chaînes
 * dans six fichiers différents.
 */

import type { TicketPriority, TicketStatus } from '@/api/types';

type Descriptor = {
  label: string;
  badge: string;
};

export const STATUS_DESCRIPTORS: Record<TicketStatus, Descriptor> = {
  open: { label: 'Ouvert', badge: 'bg-blue-100 text-blue-700 ring-blue-600/20' },
  in_progress: { label: 'En cours', badge: 'bg-amber-100 text-amber-800 ring-amber-600/20' },
  resolved: { label: 'Résolu', badge: 'bg-emerald-100 text-emerald-700 ring-emerald-600/20' },
  closed: { label: 'Fermé', badge: 'bg-slate-200 text-slate-700 ring-slate-500/20' },
};

export const PRIORITY_DESCRIPTORS: Record<TicketPriority, Descriptor> = {
  low: { label: 'Basse', badge: 'bg-slate-100 text-slate-700 ring-slate-500/20' },
  medium: { label: 'Moyenne', badge: 'bg-indigo-100 text-indigo-700 ring-indigo-600/20' },
  high: { label: 'Haute', badge: 'bg-rose-100 text-rose-700 ring-rose-600/20' },
};

export const PRIORITIES: TicketPriority[] = ['low', 'medium', 'high'];
export const STATUSES: TicketStatus[] = ['open', 'in_progress', 'resolved', 'closed'];

export function formatDateTime(iso: string | null): string {
  if (iso === null) {
    return '—';
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

export function formatDate(iso: string | null): string {
  if (iso === null) {
    return '—';
  }

  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(iso));
}