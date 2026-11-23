import { getRouteApi, Outlet, useNavigate, useRouter } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { queryClient } from '../../query-client';
import { switchCompanyRequest, AuthRequestError } from './api';
import { logoutSession, saveSession } from './session';
import { readTokens } from './token-store';

const authenticatedRoute = getRouteApi('/_authenticated');

export function AuthenticatedLayout() {
  const { auth } = authenticatedRoute.useRouteContext();
  const navigate = useNavigate();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const displayName = auth.user.name ?? auth.user.email;

  const logout = useCallback(() => {
    void logoutSession().finally(() => {
      queryClient.clear();
      void navigate({ to: '/login' });
    });
  }, [navigate]);

  const onSwitch = useCallback(
    (tenantId: string) => {
      if (tenantId === auth.tenant?.id) {
        return;
      }

      const refreshToken = readTokens()?.refreshToken;

      if (!refreshToken) {
        void navigate({ to: '/login' });
        return;
      }

      setError(null);
      void switchCompanyRequest({ tenantId, refreshToken })
        .then((session) => {
          saveSession(session);
          queryClient.clear();
          return router.invalidate();
        })
        .catch((reason: unknown) => {
          if (reason instanceof AuthRequestError) {
            setError(reason.message);
            return;
          }

          setError('Não foi possível trocar de empresa.');
        });
    },
    [auth.tenant?.id, navigate, router],
  );

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="gap-3 p-4">
          <p className="text-sm font-medium">MyroPhone</p>
          <Select
            disabled={auth.companies.length === 0}
            onValueChange={onSwitch}
            value={auth.tenant?.id}
          >
            <SelectTrigger aria-label="Empresa">
              <SelectValue placeholder="Nenhuma empresa" />
            </SelectTrigger>
            <SelectContent>
              {auth.companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </SidebarHeader>
        <SidebarContent />
        <SidebarFooter className="p-4">
          <p className="text-sm">{displayName}</p>
          <Button onClick={logout} type="button" variant="outline">
            Sair
          </Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex items-center p-2 md:hidden">
          <SidebarTrigger />
        </header>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
