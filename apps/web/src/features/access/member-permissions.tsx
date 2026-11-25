import { getRouteApi } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  accessFailureText,
  permissionTemplatesQueryKey,
  readMemberPermissionsRequest,
  readPermissionTemplatesRequest,
  updateMemberPermissionsRequest,
  type CompanyMember,
  type CompanyPermissionTemplates,
} from './api';
import { PermissionGroups } from './permission-group-list';
import {
  samePermissionKeys,
  togglePermissionKey,
  type PermissionCatalogEntry,
} from './permission-groups';

const authenticatedRoute = getRouteApi('/_authenticated');
const dialogClassName =
  'max-h-[min(40rem,calc(100dvh-2rem))] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-lg';

function OwnerPermissionsButton({ name }: { name: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <Shield />
          Permissões
        </Button>
      </DialogTrigger>
      <DialogContent className={dialogClassName}>
        <DialogHeader>
          <DialogTitle>Acesso completo</DialogTitle>
          <DialogDescription>
            {name} é proprietário e tem todas as permissões. Não dá para
            retirar nenhuma.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

function MemberGrantForm({
  catalog,
  error,
  idPrefix,
  keys,
  onSave,
  onToggle,
  pending,
  serverKeys,
}: {
  catalog: readonly PermissionCatalogEntry[];
  error: string | null;
  idPrefix: string;
  keys: readonly string[];
  onSave: () => void;
  onToggle: (key: string, enabled: boolean) => void;
  pending: boolean;
  serverKeys: readonly string[] | undefined;
}) {
  const selected = new Set(keys);
  const unchanged =
    serverKeys !== undefined && samePermissionKeys(keys, serverKeys);
  const saveDisabled = pending || unchanged || serverKeys === undefined;

  return (
    <div className="flex flex-col gap-4">
      <PermissionGroups
        catalog={catalog}
        disabled={pending}
        idPrefix={idPrefix}
        onToggle={onToggle}
        selected={selected}
      />
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button disabled={saveDisabled} onClick={onSave} type="button">
        {pending ? 'Salvando…' : 'Salvar'}
      </Button>
    </div>
  );
}

function MemberGrantBody({
  error,
  grantsError,
  grantsPending,
  grantsSuccess,
  keys,
  memberId,
  onSave,
  onToggle,
  open,
  pending,
  serverKeys,
  templates,
}: {
  error: string | null;
  grantsError: unknown;
  grantsPending: boolean;
  grantsSuccess: boolean;
  keys: readonly string[];
  memberId: string;
  onSave: () => void;
  onToggle: (key: string, enabled: boolean) => void;
  open: boolean;
  pending: boolean;
  serverKeys: readonly string[] | undefined;
  templates: {
    data: CompanyPermissionTemplates | undefined;
    error: unknown;
    isPending: boolean;
    isSuccess: boolean;
  };
}) {
  const failure = grantsError ?? templates.error;
  const loading = open && (templates.isPending || grantsPending);

  if (failure) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {accessFailureText(failure)}
      </p>
    );
  }

  if (loading) {
    return <Skeleton className="h-24 w-full" />;
  }

  if (!templates.isSuccess || !grantsSuccess) {
    return null;
  }

  return (
    <MemberGrantForm
      catalog={templates.data?.catalog ?? []}
      error={error}
      idPrefix={`member-${memberId}`}
      keys={keys}
      onSave={onSave}
      onToggle={onToggle}
      pending={pending}
      serverKeys={serverKeys}
    />
  );
}

function MemberGrantButton({ member }: { member: CompanyMember }) {
  const queryClient = useQueryClient();
  const { auth } = authenticatedRoute.useRouteContext();
  const tenantId = auth.tenant?.id ?? null;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const templates = useQuery({
    queryKey: permissionTemplatesQueryKey(tenantId),
    queryFn: readPermissionTemplatesRequest,
    enabled: open && tenantId !== null,
  });
  const grants = useQuery({
    queryKey: ['member-permissions', tenantId, member.userId],
    queryFn: () => readMemberPermissionsRequest(member.userId),
    enabled: open && tenantId !== null,
  });
  const serverKeys = grants.data?.permissionKeys;
  const keys = useMemo(
    () => draft ?? serverKeys ?? [],
    [draft, serverKeys],
  );

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);

    if (!next) {
      setDraft(null);
      setError(null);
    }
  }, []);

  const onToggle = useCallback(
    (key: string, enabled: boolean) => {
      setDraft((current) =>
        togglePermissionKey(current ?? serverKeys ?? [], key, enabled),
      );
    },
    [serverKeys],
  );

  const onSave = useCallback(() => {
    setPending(true);
    setError(null);
    void updateMemberPermissionsRequest(member.userId, keys)
      .then(() => {
        setDraft(null);
        return queryClient.invalidateQueries({
          queryKey: ['member-permissions', tenantId, member.userId],
        });
      })
      .catch((reason: unknown) => {
        setError(accessFailureText(reason));
      })
      .finally(() => {
        setPending(false);
      });
  }, [keys, member.userId, queryClient, tenantId]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <Shield />
          Permissões
        </Button>
      </DialogTrigger>
      <DialogContent className={dialogClassName}>
        <DialogHeader>
          <DialogTitle>Permissões de {member.name}</DialogTitle>
          <DialogDescription>
            Começaram no modelo da empresa. Aqui você muda só esta pessoa.
          </DialogDescription>
        </DialogHeader>
        <MemberGrantBody
          error={error}
          grantsError={grants.error}
          grantsPending={grants.isPending}
          grantsSuccess={grants.isSuccess}
          keys={keys}
          memberId={member.userId}
          onSave={onSave}
          onToggle={onToggle}
          open={open}
          pending={pending}
          serverKeys={serverKeys}
          templates={templates}
        />
      </DialogContent>
    </Dialog>
  );
}

export function MemberPermissionsButton({
  member,
}: {
  member: CompanyMember;
}) {
  if (member.role === 'OWNER') {
    return <OwnerPermissionsButton name={member.name} />;
  }

  return <MemberGrantButton member={member} />;
}
