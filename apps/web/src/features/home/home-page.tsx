import { getRouteApi } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { healthQueryOptions } from './health-query';

const authenticatedRoute = getRouteApi('/_authenticated');

export function HomePage() {
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
