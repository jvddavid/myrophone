import type { QueryClient } from '@tanstack/react-query';

export function invalidateMemberLists(queryClient: QueryClient): Promise<unknown> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['company-members'] }),
    queryClient.invalidateQueries({ queryKey: ['department-members'] }),
    queryClient.invalidateQueries({ queryKey: ['team-candidates'] }),
    queryClient.invalidateQueries({ queryKey: ['unassigned-members'] }),
    queryClient.invalidateQueries({ queryKey: ['company-teams'] }),
  ]);
}
