'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { unwrap } from '@/lib/api';
import type { Lead, LeadStats } from '@/lib/types';

export function useLeads(params?: { status?: string; search?: string; page?: number }) {
  return useQuery({
    queryKey: ['leads', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.status) searchParams.set('status', params.status);
      if (params?.search) searchParams.set('search', params.search);
      if (params?.page) searchParams.set('page', String(params.page));
      searchParams.set('pageSize', '20');

      const { data } = await api.get(`/leads?${searchParams}`);
      return unwrap(data) as { data: Lead[]; meta: any };
    },
    placeholderData: (previousData) => previousData,
  });
}

export function useLead(id: string | undefined) {
  return useQuery({
    queryKey: ['lead', id],
    queryFn: async () => {
      const { data } = await api.get(`/leads/${id}`);
      return unwrap(data) as Lead;
    },
    enabled: !!id,
  });
}

export function useLeadStats() {
  return useQuery({
    queryKey: ['lead-stats'],
    queryFn: async () => {
      const { data } = await api.get('/leads/stats');
      return unwrap(data) as LeadStats;
    },
  });
}

export function useCreateLeadForCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { customerId: string; selectedCategories?: string[] }) => {
      const { data } = await api.post('/leads/for-customer', params);
      return unwrap(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
    },
  });
}

export function useUpdateLeadStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data } = await api.patch(`/leads/${id}/status`, { status });
      return unwrap(data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
    },
  });
}

export function useUpdateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...dto }: { id: string; appointmentDate?: string; appointmentTime?: string; appointmentLocation?: string; appointmentNotes?: string }) => {
      const { data } = await api.patch(`/leads/${id}/appointment`, dto);
      return unwrap(data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useConvertLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, orderId }: { id: string; orderId: string }) => {
      const { data } = await api.patch(`/leads/${id}/convert`, { orderId });
      return unwrap(data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
    },
  });
}

export function useGenerateLeadLink() {
  return useMutation({
    mutationFn: async (categories?: string[]) => {
      const params = categories && categories.length > 0
        ? `?categories=${categories.map(encodeURIComponent).join(',')}`
        : '';
      const { data } = await api.get(`/leads/generate-link${params}`);
      return unwrap(data) as { url: string; sellerCode: string };
    },
  });
}
