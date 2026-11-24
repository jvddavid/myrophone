import { getRouteApi, Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MailPlus, Trash2, UserPlus } from 'lucide-react';
import { type ChangeEvent, type FormEvent, useCallback, useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
  ItemDescription,
} from '@/components/ui/item';
import { Skeleton } from '@/components/ui/skeleton';
import {
  accessFailureText,
  inviteMemberRequest,
  listMembersRequest,
  memberPageSize,
  removeMemberRequest,
  type CompanyMember,
} from './api';
import { MemberAvatar } from './member-avatar';
import { MemberEmpty, MemberPager, MemberSearchField } from './member-list-ui';
import { invalidateMemberLists } from './member-queries';
import { useMemberQueryState } from './member-query-state';
import { roleBadgeVariant, roleLabel } from './messages';
import { OwnerOnly } from './owner-only';
import { RemovalConfirmDialog } from './removal-confirm-dialog';

const authenticatedRoute = getRouteApi('/_authenticated');
const dialogClassName =
  'max-h-[min(40rem,calc(100dvh-2rem))] w-[calc(100%-2rem)] overflow-y-auto';
const noPeopleTitle = 'Nenhuma pessoa';
const noPeopleDescription = 'Ninguém tem acesso a esta empresa.';
const noHitsTitle = 'Nenhum resultado';
const noHitsDescription = 'Nenhuma pessoa corresponde a essa busca.';

export function AccessPage() {
  const { auth } = authenticatedRoute.useRouteContext();
  const tenantId = auth.tenant?.id ?? null;
  const isOwner = tenantId !== null && auth.role === 'OWNER';
  const { query, page, setPage, onQueryChange, onPrevious, onNext } =
    useMemberQueryState();
  const term = query.trim();
  const members = useQuery({
    queryKey: ['company-members', tenantId, term, page],
    queryFn: () =>
      listMembersRequest({ q: term, page, pageSize: memberPageSize }),
    enabled: isOwner,
  });

  useEffect(() => {
    if (!members.data) {
      return;
    }

    const lastPage = Math.max(1, Math.ceil(members.data.total / members.data.pageSize));

    if (page > lastPage) {
      setPage(lastPage);
    }
  }, [members.data, page, setPage]);

  if (!isOwner) {
    return <OwnerOnly />;
  }

  const listed = members.data;
  const searching = term.length > 0;

  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle>Acessos</CardTitle>
            <CardDescription>
              Pessoas que podem entrar nesta empresa.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <InviteDialog />
            <Button asChild>
              <Link to="/acessos/novo">
                <UserPlus />
                Criar acesso
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-4">
        <MemberSearchField id="access-search" onChange={onQueryChange} value={query} />
        {members.isPending ? <Skeleton className="h-16 w-full" /> : null}
        {members.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {accessFailureText(members.error)}
          </p>
        ) : null}
        {members.isSuccess && listed && listed.total === 0 ? (
          <MemberEmpty
            description={searching ? noHitsDescription : noPeopleDescription}
            title={searching ? noHitsTitle : noPeopleTitle}
          />
        ) : null}
        {members.isSuccess && listed && listed.total > 0 ? (
          <>
            <ItemGroup className="gap-3">
              {listed.members.map((member) => (
                <MemberRow key={member.userId} member={member} />
              ))}
            </ItemGroup>
            <MemberPager
              onNext={onNext}
              onPageChange={setPage}
              onPrevious={onPrevious}
              page={listed.page}
              pageSize={listed.pageSize}
              total={listed.total}
            />
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function InviteDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);

    if (!next) {
      setError(null);
    }
  }, []);

  const onEmailChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value);
  }, []);

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setPending(true);
      setError(null);
      void inviteMemberRequest(email.trim())
        .then(() => {
          setEmail('');
          setOpen(false);
          return invalidateMemberLists(queryClient);
        })
        .catch((reason: unknown) => {
          setError(accessFailureText(reason));
        })
        .finally(() => {
          setPending(false);
        });
    },
    [email, queryClient],
  );

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button type="button">
          <MailPlus />
          Convidar
        </Button>
      </DialogTrigger>
      <DialogContent className={dialogClassName}>
        <DialogHeader>
          <DialogTitle>Convidar</DialogTitle>
          <DialogDescription>
            A pessoa precisa já ter uma conta.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <FieldGroup>
            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor="inviteEmail">E-mail</FieldLabel>
              <Input
                autoComplete="email"
                id="inviteEmail"
                name="inviteEmail"
                onChange={onEmailChange}
                required
                type="email"
                value={email}
              />
              {error ? <FieldError>{error}</FieldError> : null}
            </Field>
            <Button disabled={pending} type="submit">
              <MailPlus />
              {pending ? 'Aguarde…' : 'Convidar'}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MemberRow({ member }: { member: CompanyMember }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);

    if (!next) {
      setError(null);
    }
  }, []);

  const onRemove = useCallback(() => {
    setPending(true);
    setError(null);
    void removeMemberRequest(member.userId)
      .then(() => {
        setOpen(false);
        return invalidateMemberLists(queryClient);
      })
      .catch((reason: unknown) => {
        setError(accessFailureText(reason));
      })
      .finally(() => {
        setPending(false);
      });
  }, [member.userId, queryClient]);

  return (
    <Item className="min-w-0" variant="outline">
      <ItemMedia>
        <MemberAvatar
          avatarUrl={member.avatarUrl}
          email={member.email}
          name={member.name}
        />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="break-words">{member.name}</ItemTitle>
        <ItemDescription className="break-all">{member.email}</ItemDescription>
      </ItemContent>
      <ItemActions className="ml-auto w-full shrink-0 flex-wrap justify-end sm:w-auto">
        <Badge variant={roleBadgeVariant(member.role)}>
          {roleLabel(member.role)}
        </Badge>
        <AlertDialog onOpenChange={onOpenChange} open={open}>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="destructive">
              <Trash2 />
              Remover
            </Button>
          </AlertDialogTrigger>
          <RemovalConfirmDialog
            confirmIcon={Trash2}
            confirmLabel="Remover"
            description={`${member.name} perde o acesso aos dados desta empresa. A conta continua e o acesso às outras empresas não muda.`}
            error={error}
            onConfirm={onRemove}
            pending={pending}
            title="Remover desta empresa"
          />
        </AlertDialog>
      </ItemActions>
    </Item>
  );
}
