import { getRouteApi, Link, Outlet, useNavigate, useRouter } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { queryClient } from '../../query-client';
import { AppSidebar } from './app-sidebar';
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
      <AppSidebar
        activeCompanyId={auth.tenant?.id ?? null}
        companies={auth.companies}
        onLogout={logout}
        onSwitch={onSwitch}
        user={{
          name: displayName,
          email: auth.user.email,
          avatar: auth.user.avatarUrl,
        }}
      />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              className="mr-2 data-[orientation=vertical]:h-4"
              orientation="vertical"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink asChild>
                    <Link to="/">MyroPhone</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>
                    {auth.tenant?.name ?? 'Painel'}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        {error ? (
          <p className="px-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
