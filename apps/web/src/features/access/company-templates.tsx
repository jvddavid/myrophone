import { getRouteApi } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import {
  accessFailureText,
  permissionTemplatesQueryKey,
  readPermissionTemplatesRequest,
  updatePermissionTemplateRequest,
} from './api';
import { PermissionGroups } from './permission-group-list';
import {
  samePermissionKeys,
  togglePermissionKey,
  type PermissionCatalogEntry,
} from './permission-groups';

const authenticatedRoute = getRouteApi('/_authenticated');

function TemplateEditor({
  role,
  title,
  description,
  catalog,
  savedKeys,
}: {
  role: 'ADMIN' | 'USER';
  title: string;
  description: string;
  catalog: readonly PermissionCatalogEntry[];
  savedKeys: readonly string[];
}) {
  const queryClient = useQueryClient();
  const { auth } = authenticatedRoute.useRouteContext();
  const tenantId = auth.tenant?.id ?? null;
  const [keys, setKeys] = useState(() => [...savedKeys]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = new Set(keys);
  const unchanged = samePermissionKeys(keys, savedKeys);

  const onToggle = useCallback((key: string, enabled: boolean) => {
    setKeys((current) => togglePermissionKey(current, key, enabled));
  }, []);

  const onSave = useCallback(() => {
    setPending(true);
    setError(null);
    void updatePermissionTemplateRequest(role, keys)
      .then(() =>
        queryClient.invalidateQueries({
          queryKey: permissionTemplatesQueryKey(tenantId),
        }),
      )
      .catch((reason: unknown) => {
        setError(accessFailureText(reason));
      })
      .finally(() => {
        setPending(false);
      });
  }, [keys, queryClient, role, tenantId]);

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-lg border p-4">
      <div className="space-y-1.5">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <PermissionGroups
        catalog={catalog}
        disabled={pending}
        idPrefix={`template-${role}`}
        onToggle={onToggle}
        selected={selected}
      />
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button disabled={pending || unchanged} onClick={onSave} type="button">
        {pending ? 'Salvando…' : 'Salvar modelo'}
      </Button>
    </section>
  );
}

function TemplatesReady({
  catalog,
  adminKeys,
  userKeys,
}: {
  catalog: readonly PermissionCatalogEntry[];
  adminKeys: readonly string[];
  userKeys: readonly string[];
}) {
  if (catalog.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Nenhuma permissão</EmptyTitle>
          <EmptyDescription>
            Não há permissões para configurar nos modelos.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <TemplateEditor
        catalog={catalog}
        description="Novos administradores recebem este conjunto."
        role="ADMIN"
        savedKeys={adminKeys}
        title="Administrador"
      />
      <TemplateEditor
        catalog={catalog}
        description="É o visualizador da empresa. Novos usuários recebem este conjunto."
        role="USER"
        savedKeys={userKeys}
        title="Usuário"
      />
    </div>
  );
}

export function CompanyTemplates() {
  const { auth } = authenticatedRoute.useRouteContext();
  const tenantId = auth.tenant?.id ?? null;
  const templates = useQuery({
    queryKey: permissionTemplatesQueryKey(tenantId),
    queryFn: readPermissionTemplatesRequest,
    enabled: tenantId !== null,
  });

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Permissões padrão</CardTitle>
        <CardDescription>
          Vale para quem entrar depois. Quem já está na empresa continua com
          as permissões que tem hoje.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {templates.isPending ? <Skeleton className="h-24 w-full" /> : null}
        {templates.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {accessFailureText(templates.error)}
          </p>
        ) : null}
        {templates.isSuccess ? (
          <TemplatesReady
            adminKeys={templates.data.templates.ADMIN}
            catalog={templates.data.catalog}
            userKeys={templates.data.templates.USER}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
