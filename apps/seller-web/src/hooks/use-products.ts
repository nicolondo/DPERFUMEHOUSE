'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { unwrap } from '@/lib/api';

interface UseProductsParams {
  search?: string;
  categoryId?: string;
  page?: number;
  limit?: number;
}

export function useProducts({ search, categoryId, page = 1, limit = 20 }: UseProductsParams = {}) {
  return useQuery({
    queryKey: ['products', { search, categoryId, page, limit }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (categoryId) params.set('category', categoryId);
      params.set('page', String(page));
      params.set('limit', String(limit));

      const { data } = await api.get(`/products?${params}`);
      return unwrap(data);
    },
    placeholderData: (previousData) => previousData,
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const { data } = await api.get(`/products/${id}`);
      return unwrap(data);
    },
    enabled: !!id,
  });
}

export function useRequestProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ variantId, quantity, notes }: { variantId: string; quantity: number; notes?: string }) => {
      const { data } = await api.post('/product-requests', { variantId, quantity, notes });
      return unwrap(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-requests'] });
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get('/products/categories');
      return unwrap(data);
    },
    staleTime: 5 * 60 * 1000,
  });
}
