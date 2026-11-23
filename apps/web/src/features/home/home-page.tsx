import { getRouteApi, useRouter } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useState, type FormEvent } from 'react';
import { AuthRequestError, createCompanyRequest } from '../auth/api';
import { CreateCompanyForm } from '../auth/company-panel';
import { showCreateCompany } from '../auth/show-create-company';
import { saveSession } from '../auth/session';
import { readTokens } from '../auth/token-store';
import { queryClient } from '../../query-client';
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
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const name = String(
        new FormData(event.currentTarget).get('companyName') ?? '',
      ).trim();
      const refreshToken = readTokens()?.refreshToken;

      if (!refreshToken) {
        setError('Sessão expirada. Entre novamente.');
        return;
      }

      setPending(true);
      setError(null);
      void createCompanyRequest({ name, refreshToken })
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

  return <CreateCompanyForm error={error} onSubmit={onSubmit} pending={pending} />;
}

function CompanyPanel() {
  const { auth } = authenticatedRoute.useRouteContext();
  const health = useQuery(healthQueryOptions());

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
          MyroPhone
        </p>
        <h1 className="text-4xl font-bold">Painel</h1>
        <p className="text-muted-foreground">
          Sessão de {auth.user.email}
          {auth.tenant ? ` em ${auth.tenant.name}` : ''}.
        </p>
        <p className="text-sm text-muted-foreground">
          {describeApiStatus(health.status)}
        </p>
      </header>

      <section className="rounded-xl border bg-card p-6 text-card-foreground">
        <h2 className="text-lg font-semibold">Acesso</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Papel</dt>
            <dd>{auth.role ?? 'Nenhum'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Permissões</dt>
            <dd>{auth.permissions.join(', ') || 'Nenhuma'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Times</dt>
            <dd>{auth.teams.map((team) => team.name).join(', ') || 'Nenhum'}</dd>
          </div>
        </dl>
      </section>
    </main>
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
