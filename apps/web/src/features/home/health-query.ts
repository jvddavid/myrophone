import { queryOptions } from '@tanstack/react-query';
import { getApi } from '../../api/client';

export function healthQueryOptions() {
  return queryOptions({
    queryKey: ['health'],
    staleTime: 15_000,
    queryFn: async ({ signal }) => {
      const { data, error } = await getApi().health.get({
        fetch: { signal },
      });

      if (error) {
        throw error;
      }

      return data;
    },
  });
}
