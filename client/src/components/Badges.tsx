import { PRIORITY_DESCRIPTORS, STATUS_DESCRIPTORS } from '@/lib/labels';
import type { TicketPriority, TicketStatus } from '@/api/types';

/**
 * Badges de statut et de priorité.
 *
 * Les couleurs viennent de `lib/labels.ts` : un statut ne peut pas être bleu
 * sur une page et vert sur une autre.
 */

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${className}`}
    >
      {label}
    </span>
  );
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  const descriptor = STATUS_DESCRIPTORS[status];
  return <Badge label={descriptor.label} className={descriptor.badge} />;
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const descriptor = PRIORITY_DESCRIPTORS[priority];
  return <Badge label={descriptor.label} className={descriptor.badge} />;
}