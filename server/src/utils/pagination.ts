import { z } from 'zod';

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export const paginationSchema = z.object({
  page: z.coerce
    .number()
    .int('Le paramètre "page" doit être un entier.')
    .min(1, 'Le paramètre "page" doit être supérieur ou égal à 1.')
    .default(DEFAULT_PAGE),
  limit: z.coerce
    .number()
    .int('Le paramètre "limit" doit être un entier.')
    .min(1, 'Le paramètre "limit" doit être supérieur ou égal à 1.')
    .max(MAX_LIMIT, `Le paramètre "limit" ne peut pas dépasser ${MAX_LIMIT}.`)
    .default(DEFAULT_LIMIT),
});

export type Pagination = z.infer<typeof paginationSchema>;

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export function buildMeta({ page, limit }: Pagination, total: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
  };
}

/** Calcule l'offset SQL correspondant à une page. */
export function toOffset({ page, limit }: Pagination): number {
  return (page - 1) * limit;
}
