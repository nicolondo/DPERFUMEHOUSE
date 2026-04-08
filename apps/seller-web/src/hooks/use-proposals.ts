'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { unwrap } from '@/lib/api';

interface UseProposalsParams {
  search?: string;
  page?: number;
}

export function useProposals({ search, page = 1 }: UseProposalsParams = {}) {
  return useQuery({
    queryKey: ['proposals', { search, page }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('page', String(page));
      const { data } = await api.get(`/proposals?${params}`);
      return unwrap(data);
    },
    placeholderData: (previousData) => previousData,
  });
}

export function useProposal(id: string | undefined) {
  return useQuery({
    queryKey: ['proposal', id],
    queryFn: async () => {
      const { data } = await api.get(`/proposals/${id}`);
      return unwrap(data);
    },
    enabled: !!id,
  });
}

export function useCreateProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      customerId?: string;
      title?: string;
      message?: string;
      expiresAt?: string;
      items: { variantId: string; sellerNote?: string; sortOrder?: number }[];
    }) => {
      const { data } = await api.post('/proposals', input);
      return unwrap(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
  });
}

export function useUpdateProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: {
      id: string;
      title?: string;
      message?: string;
      expiresAt?: string;
      items?: { variantId: string; sellerNote?: string; sortOrder?: number }[];
    }) => {
      const { data } = await api.patch(`/proposals/${id}`, input);
      return unwrap(data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['proposal', variables.id] });
    },
  });
}

export function useDeleteProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/proposals/${id}`);
      return unwrap(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
  });
}
