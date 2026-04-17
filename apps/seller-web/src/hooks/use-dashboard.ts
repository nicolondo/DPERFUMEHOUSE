'use client';

import { useQuery } from '@tanstack/react-query';
import api, { unwrap } from '@/lib/api';
import type { DashboardStats } from '@/lib/types';

interface UseDashboardParams {
  period: 'week' | 'month';
  offset?: number;
}

export function useDashboard({ period, offset = 0 }: UseDashboardParams) {
  return useQuery({
    queryKey: ['dashboard', { period, offset }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('period', period);
      if (offset !== undefined) params.set('offset', String(offset));

      const { data } = await api.get(`/dashboard/seller?${params}`);
      return unwrap(data) as DashboardStats;
    },
    staleTime: 0,
  });
}
