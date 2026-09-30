import { z } from 'zod';

export const userRoleSchema = z.enum(['admin', 'agent']);
export type UserRole = z.infer<typeof userRoleSchema>;

export const ticketStatusSchema = z.enum(['open', 'in_progress', 'resolved', 'closed']);
export type TicketStatus = z.infer<typeof ticketStatusSchema>;

export const ticketPrioritySchema = z.enum(['low', 'medium', 'high']);
export type TicketPriority = z.infer<typeof ticketPrioritySchema>;

export const uuidSchema = z.string().uuid('Identifiant invalide : UUID attendu.');

export const idParamSchema = z.object({
  id: uuidSchema,
});

/** Constante : les 3 tables sont bornées en longueur par le schéma SQL. */
export const TITLE_MAX = 200;
export const DESCRIPTION_MAX = 5000;
export const COMMENT_MAX = 5000;

/** Trim centralisé : les espaces de bord ne sont jamais stockés. */
export const trimmedString = (max: number, label: string) =>
  z
    .string({ required_error: `${label} est requis.`, invalid_type_error: `${label} doit être une chaîne.` })
    .trim()
    .min(1, `${label} ne peut pas être vide.`)
    .max(max, `${label} ne peut pas dépasser ${max} caractères.`);
