import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PriorityBadge, StatusBadge } from './Badges';
import { formatDate, formatDateTime, PRIORITIES, STATUSES } from '@/lib/labels';
import { STATUS_DESCRIPTORS, PRIORITY_DESCRIPTORS } from '@/lib/labels';
import type { TicketPriority, TicketStatus } from '@/api/types';

describe('StatusBadge', () => {
  it.each(STATUSES)('affiche le libellé de %s', (status: TicketStatus) => {
    render(<StatusBadge status={status} />);

    expect(screen.getByText(STATUS_DESCRIPTORS[status].label)).toBeInTheDocument();
  });

  it('distingue les quatre statuts', () => {
    const labels = STATUSES.map((status) => STATUS_DESCRIPTORS[status].label);

    expect(new Set(labels).size).toBe(4);
  });
});

describe('PriorityBadge', () => {
  it.each(PRIORITIES)('affiche le libellé de %s', (priority: TicketPriority) => {
    render(<PriorityBadge priority={priority} />);

    expect(screen.getByText(PRIORITY_DESCRIPTORS[priority].label)).toBeInTheDocument();
  });
});

describe('formatage des dates', () => {
  it('affiche un tiret cadratin pour une date nulle', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDateTime(null)).toBe('—');
  });

  it('formate une date réelle en français', () => {
    const rendered = formatDate('2026-01-02T10:00:00.000Z');

    expect(rendered).not.toBe('—');
    expect(rendered).toContain('2026');
  });
});