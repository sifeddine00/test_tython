import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { commentsApi } from '@/api';
import type { Comment } from '@/api/types';

/**
 * Commentaires d'un ticket.
 *
 * La liste est invalidée après chaque ajout : le cache ne sert qu'à éviter un
 * aller-retour au changement de page, jamais à afficher un commentaire absent.
 */

export const commentKeys = {
  byTicket: (ticketId: string) => ['comments', ticketId] as const,
};

export function useTicketComments(ticketId: string | undefined): UseQueryResult<Comment[]> {
  return useQuery({
    queryKey: commentKeys.byTicket(ticketId ?? ''),
    queryFn: () => commentsApi.listByTicket(ticketId as string),
    enabled: ticketId !== undefined,
  });
}

export function useCreateComment(ticketId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (message: string) => commentsApi.create(ticketId, message),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: commentKeys.byTicket(ticketId) });
    },
  });
}