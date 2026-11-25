import { getRouteApi, useRouter } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';
import { AuthRequestError, createCompanyRequest } from '../auth/api';
import { CompanyMark } from '../auth/company-mark';
import { CreateCompanyForm } from '../auth/company-panel';
import type { CompanyDraft } from '../auth/company-profile';
import { showCreateCompany } from '../auth/show-create-company';
import { saveSession } from '../auth/session';
import { readTokens } from '../auth/token-store';
import { queryClient } from '../../query-client';
import { PermissionDenied } from '../access/permission-denied';
import { canViewPanel } from '../access/navigation';
import { healthQueryOptions } from './health-query';

const authenticatedRoute = getRouteApi('/_authenticated');

export function HomePage() {
  const { auth } = authenticatedRoute.useRouteContext();

  if (showCreateCompany(auth.tenant)) {
    return <CreateCompanyPage />;
  }

  return <CompanyPanel />;
}

function CreateCompanyPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = useCallback(
    (draft: CompanyDraft) => {
      const refreshToken = readTokens()?.refreshToken;

      if (!refreshToken) {
        setError('Sessão expirada. Entre novamente.');
        return;
      }

      setPending(true);
      setError(null);
      void createCompanyRequest({
        name: draft.name,
        description: draft.description,
        logoUrl: draft.logoUrl || undefined,
        refreshToken,
      })
        .then((session) => {
          saveSession(session);
          queryClient.clear();
          return router.invalidate();
        })
        .catch((reason: unknown) => {
          setError(
            reason instanceof AuthRequestError
              ? reason.message
              : 'Não foi possível criar a empresa.',
          );
        })
        .finally(() => {
          setPending(false);
        });
    },
    [router],
  );

  return (
    <CreateCompanyForm error={error} onSubmit={onSubmit} pending={pending} />
  );
}

function CompanyPanel() {
  const { auth } = authenticatedRoute.useRouteContext();
  const health = useQuery(healthQueryOptions());
  const tenant = auth.tenant;

  if (!tenant) {
    return null;
  }

  if (!canViewPanel(auth.teamPermissions)) {
    return (
      <PermissionDenied
        description="Você não pode ver o painel desta empresa."
        title="Sem permissão"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Item variant="outline">
        <ItemMedia>
          <CompanyMark logoUrl={tenant.logoUrl} name={tenant.name} />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{tenant.name}</ItemTitle>
          <ItemDescription>
            {tenant.description ?? 'Sem descrição'}
          </ItemDescription>
        </ItemContent>
      </Item>

      <Card>
        <CardHeader>
          <CardTitle>Acesso</CardTitle>
          <CardDescription>
            Sessão de {auth.user.email}. {describeApiStatus(health.status)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Papel</dt>
              <dd>{auth.role ?? 'Nenhum'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Permissões</dt>
              <dd className="text-right">
                {auth.permissions.join(', ') || 'Nenhuma'}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Times</dt>
              <dd>
                {auth.teams.map((team) => team.name).join(', ') || 'Nenhum'}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

function describeApiStatus(status: 'pending' | 'error' | 'success'): string {
  if (status === 'pending') {
    return 'Consultando a API…';
  }

  if (status === 'error') {
    return 'API indisponível';
  }

  return 'API no ar';
}
