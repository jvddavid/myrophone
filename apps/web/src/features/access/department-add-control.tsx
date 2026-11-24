import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  accessFailureText,
  addTeamMemberRequest,
  listTeamCandidatesRequest,
  memberPageSize,
  type CompanyMember,
} from './api';
import { MemberEmpty, MemberPager, MemberSearchField } from './member-list-ui';
import { invalidateMemberLists } from './member-queries';
import { useMemberQueryState } from './member-query-state';

const dialogClassName =
  'max-h-[min(40rem,calc(100dvh-2rem))] w-[calc(100%-2rem)] overflow-y-auto';
const noPeopleTitle = 'Ninguém para adicionar';
const noPeopleDescription =
  'Todas as pessoas desta empresa já estão neste departamento.';
const noHitsTitle = 'Nenhum resultado';
const noHitsDescription = 'Nenhuma pessoa corresponde a essa busca.';

function CandidateRow({
  member,
  disabled,
  onAdd,
}: {
  member: CompanyMember;
  disabled: boolean;
  onAdd: (userId: string) => void;
}) {
  const onClick = useCallback(() => {
    onAdd(member.userId);
  }, [member.userId, onAdd]);

  return (
    <li className="flex min-w-0 items-center gap-3 rounded-md border p-2">
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{member.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {member.email}
        </span>
      </span>
      <Button
        aria-label={`Adicionar ${member.name}`}
        className="shrink-0"
        disabled={disabled}
        onClick={onClick}
        size="sm"
        type="button"
      >
        <UserPlus />
        Adicionar
      </Button>
    </li>
  );
}

function DepartmentCandidatePicker({
  teamId,
  open,
  onOpenChange,
}: {
  teamId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { query, page, setPage, onQueryChange, onPrevious, onNext } =
    useMemberQueryState();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const term = query.trim();
  const candidates = useQuery({
    queryKey: ['team-candidates', teamId, term, page],
    queryFn: () =>
      listTeamCandidatesRequest(teamId, {
        q: term,
        page,
        pageSize: memberPageSize,
      }),
    enabled: open,
  });

  useEffect(() => {
    if (!candidates.data) {
      return;
    }

    const lastPage = Math.max(
      1,
      Math.ceil(candidates.data.total / candidates.data.pageSize),
    );

    if (page > lastPage) {
      setPage(lastPage);
    }
  }, [candidates.data, page, setPage]);

  const onAdd = useCallback(
    (userId: string) => {
      setPendingId(userId);
      setError(null);
      void addTeamMemberRequest(teamId, userId)
        .then(async () => {
          await invalidateMemberLists(queryClient);
          onOpenChange(false);
        })
        .catch((reason: unknown) => {
          setError(accessFailureText(reason));
        })
        .finally(() => {
          setPendingId((current) => (current === userId ? null : current));
        });
    },
    [onOpenChange, queryClient, teamId],
  );

  const listed = candidates.data;
  const searching = term.length > 0;

  return (
    <>
      <MemberSearchField
        id={`department-add-${teamId}`}
        onChange={onQueryChange}
        value={query}
      />
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {candidates.isPending ? <Skeleton className="h-16 w-full" /> : null}
      {candidates.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {accessFailureText(candidates.error)}
        </p>
      ) : null}
      {candidates.isSuccess && listed && listed.total === 0 ? (
        <MemberEmpty
          description={searching ? noHitsDescription : noPeopleDescription}
          title={searching ? noHitsTitle : noPeopleTitle}
        />
      ) : null}
      {candidates.isSuccess && listed && listed.total > 0 ? (
        <>
          <ul className="flex flex-col gap-2">
            {listed.members.map((member) => (
              <CandidateRow
                disabled={pendingId !== null}
                key={member.userId}
                member={member}
                onAdd={onAdd}
              />
            ))}
          </ul>
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
    </>
  );
}

export function DepartmentAddControl({
  teamId,
  open,
  onOpenChange,
}: {
  teamId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className={dialogClassName}>
        <DialogHeader>
          <DialogTitle>Adicionar</DialogTitle>
          <DialogDescription>
            Escolha alguém que já faz parte desta empresa e ainda não está neste
            departamento.
          </DialogDescription>
        </DialogHeader>
        <DepartmentCandidatePicker
          key={teamId}
          onOpenChange={onOpenChange}
          open={open}
          teamId={teamId}
        />
      </DialogContent>
    </Dialog>
  );
}
