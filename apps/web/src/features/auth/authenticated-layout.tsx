import { getRouteApi, Outlet, useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { queryClient } from '../../query-client';
import { logoutSession } from './session';

const authenticatedRoute = getRouteApi('/_authenticated');

export function AuthenticatedLayout() {
  const { auth } = authenticatedRoute.useRouteContext();
  const navigate = useNavigate();
  const displayName = auth.user.name ?? auth.user.email;

  const logout = useCallback(() => {
    void logoutSession().finally(() => {
      queryClient.clear();
      void navigate({ to: '/login' });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-sm font-medium">{auth.tenant?.name ?? 'MyroPhone'}</p>
            <p className="text-xs text-muted-foreground">
              {displayName}
              {auth.role ? ` · ${auth.role}` : ''}
            </p>
          </div>
          <Button onClick={logout} type="button" variant="outline">
            Sair
          </Button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
