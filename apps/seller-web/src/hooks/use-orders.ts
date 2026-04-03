'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { unwrap } from '@/lib/api';
import type { Order, OrderStatus, CreateOrderInput } from '@/lib/types';

interface UseOrdersParams {
  status?: OrderStatus | 'all';
  page?: number;
  limit?: number;
}

export function useOrders({ status, page = 1, limit = 20 }: UseOrdersParams = {}) {
  return useQuery({
    queryKey: ['orders', { status, page, limit }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status && status !== 'all') params.set('status', status);
      params.set('page', String(page));
      params.set('limit', String(limit));

      const { data } = await api.get(`/orders?${params}`);
      return unwrap(data);
    },
    placeholderData: (previousData) => previousData,
  });
}

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const { data } = await api.get(`/orders/${id}`);
      return unwrap(data);
    },
    enabled: !!id,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateOrderInput) => {
      const { data } = await api.post('/orders', input);
      return unwrap(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useProcessOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, action, data: actionData }: { id: string; action: string; data?: Record<string, unknown> }) => {
      const { data } = await api.post(`/orders/${id}/${action}`, actionData);
      return unwrap(data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      if (data?.id) queryClient.invalidateQueries({ queryKey: ['order', data.id] });
    },
  });
}

export function usePendingOrdersCount() {
  return useQuery({
    queryKey: ['orders', 'pending-count'],
    queryFn: async () => {
      const { data } = await api.get('/orders?status=PENDING_PAYMENT&limit=1');
      const result = unwrap(data);
      return result?.meta?.total ?? result?.pagination?.total ?? 0;
    },
    refetchInterval: 30000,
  });
}

export function useUpdateOrderAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, addressId }: { id: string; addressId: string }) => {
      const { data } = await api.patch(`/orders/${id}/address`, { addressId });
      return unwrap(data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      if (data?.id) queryClient.invalidateQueries({ queryKey: ['order', data.id] });
    },
  });
}
