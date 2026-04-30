'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { unwrap } from '@/lib/api';
import type { Customer, CreateCustomerInput, Address } from '@/lib/types';

export function useCustomers(search?: string) {
  return useQuery({
    queryKey: ['customers', { search }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('pageSize', '500');

      const { data } = await api.get(`/customers?${params}`);
      return unwrap(data);
    },
    placeholderData: (previousData) => previousData,
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const { data } = await api.get(`/customers/${id}`);
      return unwrap(data);
    },
    enabled: !!id,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCustomerInput) => {
      const { data } = await api.post('/customers', input);
      return unwrap(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<CreateCustomerInput> & { id: string }) => {
      const { data } = await api.put(`/customers/${id}`, input);
      return unwrap(data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      if (data?.id) queryClient.invalidateQueries({ queryKey: ['customer', data.id] });
    },
  });
}

export function useAddAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ customerId, ...address }: Omit<Address, 'id' | 'customerId'> & { customerId: string }) => {
      const { data } = await api.post(`/customers/${customerId}/addresses`, address);
      return unwrap(data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer', variables.customerId] });
    },
  });
}

export function useUpdateAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ customerId, addressId, ...address }: Partial<Omit<Address, 'id' | 'customerId'>> & { customerId: string; addressId: string }) => {
      const { data } = await api.put(`/customers/${customerId}/addresses/${addressId}`, address);
      return unwrap(data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer', variables.customerId] });
    },
  });
}

export function usePromoStatus() {
  return useQuery({
    queryKey: ['promo-status'],
    queryFn: async () => {
      const { data } = await api.get('/customers/promo-status');
      return unwrap(data);
    },
  });
}

export function useCustomerPromoConfig(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customer-promo-config', customerId],
    queryFn: async () => {
      const { data } = await api.get(`/customers/${customerId}/promo-config`);
      return unwrap(data);
    },
    enabled: !!customerId,
  });
}

export function useUpdateCustomerPromoConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      customerId,
      ...dto
    }: {
      customerId: string;
      useGlobal: boolean;
      discountPercent?: number;
      discountLimit?: number;
    }) => {
      const { data } = await api.patch(`/customers/${customerId}/promo-config`, dto);
      return unwrap(data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customer-promo-config', variables.customerId] });
    },
  });
}
