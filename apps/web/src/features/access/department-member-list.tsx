import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useCallback, useEffect } from 'react';
import { ItemGroup } from '@/components/ui/item';
import { Skeleton } from '@/components/ui/skeleton';
import {
  accessFailureText,
  listMembersRequest,
  listTeamMembersRequest,
  memberPageSize,
  type MemberListPage,
} from './api';
import { DepartmentMemberRow } from './department-member-row';
import { MemberEmpty, MemberPager, MemberSearchField } from './member-list-ui';
import { useMemberQueryState } from './member-query-state';
import { isAbortError, memberSearchRetry, runMemberSearch } from './member-search';

const authenticatedRoute = getRouteApi('/_authenticated');
const noPeopleTitle = 'Nenhuma pessoa';
const noHitsTitle = 'Nenhum resultado';

function DepartmentMemberEmpty({
  isSuccess,
  listed,
  searching,
  teamId,
}: {
  isSuccess: boolean;
  listed: MemberListPage | undefined;
  searching: boolean;
  teamId: string | null;
}) {
  if (!isSuccess || !listed || listed.total !== 0) {
    return null;
  }

  const noPeopleDescription = teamId
    ? 'Este departamento ainda não tem ninguém.'
    : 'Ninguém está sem departamento.';
  const noHitsDescription = teamId
    ? 'Nenhuma pessoa deste departamento corresponde a essa busca.'
    : 'Nenhuma pessoa sem departamento corresponde a essa busca.';

  return (
    <MemberEmpty
      description={searching ? noHitsDescription : noPeopleDescription}
      title={searching ? noHitsTitle : noPeopleTitle}
    />
  );
}

function DepartmentMemberRows({
  isSuccess,
  listed,
  teamId,
}: {
  isSuccess: boolean;
  listed: MemberListPage | undefined;
  teamId: string | null;
}) {
  if (!isSuccess || !listed || listed.total <= 0) {
    return null;
  }

  return (
    <ItemGroup className="gap-3">
      {listed.members.map((member) => (
        <DepartmentMemberRow key={member.userId} member={member} teamId={teamId} />
      ))}
    </ItemGroup>
  );
}

function DepartmentMemberPager({
  isSuccess,
  listed,
  onNext,
  onPageChange,
  onPrevious,
}: {
  isSuccess: boolean;
  listed: MemberListPage | undefined;
  onNext: () => void;
  onPageChange: (page: number) => void;
  onPrevious: () => void;
}) {
  if (!isSuccess || !listed || listed.total <= 0) {
    return null;
  }

  return (
    <MemberPager
      onNext={onNext}
      onPageChange={onPageChange}
      onPrevious={onPrevious}
      page={listed.page}
      pageSize={listed.pageSize}
      total={listed.total}
    />
  );
}

export function DepartmentMemberList({ teamId }: { teamId: string | null }) {
  const { auth } = authenticatedRoute.useRouteContext();
  const tenantId = auth.tenant?.id ?? null;
  const { term, page, snapshotRef, commitTerm, onPrevious, onNext, onPageChange } =
    useMemberQueryState();
  const members = useQuery({
    queryKey: ['department-members', tenantId, teamId ?? 'none', term, page],
    queryFn: ({ signal }) => {
      const started = { term, page };
      const params = { q: term, page, pageSize: memberPageSize, signal };
      const request = teamId
        ? listTeamMembersRequest(teamId, params)
        : listMembersRequest({ ...params, unassigned: true });

      return runMemberSearch(started, () => snapshotRef.current, signal, request);
    },
    retry: memberSearchRetry,
    enabled: tenantId !== null,
  });
  const refetchMembers = members.refetch;

  const onSearch = useCallback(
    (value: string) => {
      commitTerm(value);
    },
    [commitTerm],
  );

  const onSearchNow = useCallback(
    (value: string) => {
      if (!commitTerm(value)) {
        void refetchMembers();
      }
    },
    [commitTerm, refetchMembers],
  );

  useEffect(() => {
    if (!members.data) {
      return;
    }

    const lastPage = Math.max(1, Math.ceil(members.data.total / members.data.pageSize));

    if (page > lastPage) {
      onPageChange(lastPage);
    }
  }, [members.data, onPageChange, page]);

  const listed = members.data;
  const searching = term.length > 0;
  const searchId = teamId ? `department-search-${teamId}` : 'department-search-none';

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <MemberSearchField
        id={searchId}
        onSearch={onSearch}
        onSearchNow={onSearchNow}
        pending={members.isFetching}
      />
      {members.isPending ? <Skeleton className="h-16 w-full" /> : null}
      {members.isError && !isAbortError(members.error) ? (
        <p className="text-sm text-destructive" role="alert">
          {accessFailureText(members.error)}
        </p>
      ) : null}
      <DepartmentMemberEmpty
        isSuccess={members.isSuccess}
        listed={listed}
        searching={searching}
        teamId={teamId}
      />
      <DepartmentMemberRows isSuccess={members.isSuccess} listed={listed} teamId={teamId} />
      <DepartmentMemberPager
        isSuccess={members.isSuccess}
        listed={listed}
        onNext={onNext}
        onPageChange={onPageChange}
        onPrevious={onPrevious}
      />
    </div>
  );
}
