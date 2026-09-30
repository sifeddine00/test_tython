import { z } from 'zod';
import {
  DESCRIPTION_MAX,
  TITLE_MAX,
  ticketPrioritySchema,
  ticketStatusSchema,
  uuidSchema,
} from '../shared/schemas.js';

export const createTicketSchema = z.object({
  title: z
    .string({ required_error: 'Le titre est requis.' })
    .trim()
    .min(3, 'Le titre doit contenir au moins 3 caractères.')
    .max(TITLE_MAX, `Le titre ne peut pas dépasser ${TITLE_MAX} caractères.`),
  description: z
    .string({ required_error: 'La description est requise.' })
    .trim()
    .min(5, 'La description doit contenir au moins 5 caractères.')
    .max(DESCRIPTION_MAX, `La description ne peut pas dépasser ${DESCRIPTION_MAX} caractères.`),
  priority: ticketPrioritySchema.default('medium'),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;

/**
 * Modification d'un ticket.
 * Le statut passe exclusivement par PATCH /:id/status : `strict` fait échouer
 * un `status` envoyé ici au lieu de l'ignorer silencieusement.
 */
export const updateTicketSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Le titre doit contenir au moins 3 caractères.')
      .max(TITLE_MAX, `Le titre ne peut pas dépasser ${TITLE_MAX} caractères.`)
      .optional(),
    description: z
      .string()
      .trim()
      .min(5, 'La description doit contenir au moins 5 caractères.')
      .max(DESCRIPTION_MAX, `La description ne peut pas dépasser ${DESCRIPTION_MAX} caractères.`)
      .optional(),
    priority: ticketPrioritySchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Fournissez au moins un champ à modifier (title, description ou priority).',
  });

export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

/**
 * Changement de statut. Le CDC ne définit aucun champ supplémentaire :
 * tout l'historique passe par POST /:id/comments, qui refuse les tickets closed.
 */
export const updateStatusSchema = z
  .object({
    status: ticketStatusSchema,
  })
  .strict();

export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;

/**
 * Assignation. `assignedTo: null` désassigne le ticket.
 * Le rôle de la cible est vérifié par le service, pas par le schéma.
 */
export const assignTicketSchema = z
  .object({
    assignedTo: z.union([uuidSchema, z.null()]),
  })
  .strict();

export type AssignTicketInput = z.infer<typeof assignTicketSchema>;

/** Filtres de la liste de tickets (section 4.2 du CDC). */
export const listTicketsQuerySchema = z.object({
  status: ticketStatusSchema.optional(),
  priority: ticketPrioritySchema.optional(),
  // `unassigned` est un mot-clé explicite : le paramètre reste un identifiant
  // dans tous les autres cas, ce qui évite un second paramètre.
  assignedTo: z.union([uuidSchema, z.literal('unassigned')]).optional(),
  search: z
    .string()
    .trim()
    .min(1, 'Le terme de recherche ne peut pas être vide.')
    .max(200, 'Le terme de recherche ne peut pas dépasser 200 caractères.')
    .optional(),
  page: z.coerce
    .number()
    .int()
    .min(1, 'Le paramètre "page" doit être supérieur ou égal à 1.')
    .default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1, 'Le paramètre "limit" doit être supérieur ou égal à 1.')
    .max(100, 'Le paramètre "limit" ne peut pas dépasser 100.')
    .default(20),
});

export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;
