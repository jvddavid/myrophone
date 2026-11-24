import { getRouteApi } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { listMembersRequest, listTeamsRequest } from './api';
import { DepartmentAccordion } from './department-accordion';
import { DepartmentCreateDialog } from './department-create-dialog';
import { OwnerOnly } from './owner-only';

const authenticatedRoute = getRouteApi('/_authenticated');

export function DepartmentsPage() {
  const { auth } = authenticatedRoute.useRouteContext();
  const tenantId = auth.tenant?.id ?? null;
  const isOwner = tenantId !== null && auth.role === 'OWNER';
  const unassignedQuery = useQuery({
    queryKey: ['unassigned-members', tenantId],
    queryFn: () =>
      listMembersRequest({
        page: 1,
        pageSize: 1,
        unassigned: true,
        q: '',
      }),
    enabled: isOwner,
  });
  const teamsQuery = useQuery({
    queryKey: ['company-teams', tenantId],
    queryFn: listTeamsRequest,
    enabled: isOwner,
  });
  const [openSections, setOpenSections] = useState<string[]>([]);
  const activeTeams = useMemo(
    () => (teamsQuery.data ?? []).filter((team) => team.isActive),
    [teamsQuery.data],
  );

  const onCreated = useCallback((teamId: string) => {
    setOpenSections((current) => {
      const openIds = new Set(current);

      if (openIds.has(teamId)) {
        return current;
      }

      return [...current, teamId];
    });
  }, []);

  const onOpenChange = useCallback((value: string[]) => {
    setOpenSections(value);
  }, []);

  if (!isOwner) {
    return <OwnerOnly />;
  }

  const pending = unassignedQuery.isPending || teamsQuery.isPending;
  const failure = unassignedQuery.error ?? teamsQuery.error;
  const ready = unassignedQuery.isSuccess && teamsQuery.isSuccess;

  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <CardTitle>Departamentos</CardTitle>
            <CardDescription>
              Quem está em cada departamento desta empresa.
            </CardDescription>
          </div>
          <DepartmentCreateDialog onCreated={onCreated} />
        </div>
      </CardHeader>
      <CardContent className="min-w-0">
        <DepartmentAccordion
          failure={failure}
          onOpenChange={onOpenChange}
          openSections={openSections}
          pending={pending}
          ready={ready}
          teams={activeTeams}
          unassignedTotal={unassignedQuery.data?.total ?? 0}
        />
      </CardContent>
    </Card>
  );
}
