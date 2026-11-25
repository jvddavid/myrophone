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
import { departmentHeaderActions } from './department-actions';
import { DepartmentCreateDialog } from './department-create-dialog';
import {
  canManageDepartmentPeople,
  canManageDepartments,
  canReadDepartments,
  canReadPeople,
} from './navigation';
import { PermissionDenied } from './permission-denied';

const authenticatedRoute = getRouteApi('/_authenticated');

export function DepartmentsPage() {
  const { auth } = authenticatedRoute.useRouteContext();
  const tenantId = auth.tenant?.id ?? null;
  const canListDepartments =
    tenantId !== null && canReadDepartments(auth.permissions);
  const canListPeople = canReadPeople(auth.permissions);
  const headerActions = departmentHeaderActions({
    canAddPeople: canManageDepartmentPeople(auth.permissions),
    canConfigure: canManageDepartments(auth.permissions),
  });
  const unassignedQuery = useQuery({
    queryKey: ['unassigned-members', tenantId],
    queryFn: () =>
      listMembersRequest({
        page: 1,
        pageSize: 1,
        unassigned: true,
        q: '',
      }),
    enabled: canListDepartments && canListPeople,
  });
  const teamsQuery = useQuery({
    queryKey: ['company-teams', tenantId],
    queryFn: listTeamsRequest,
    enabled: canListDepartments,
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

  if (!canListDepartments) {
    return (
      <PermissionDenied
        description="Você não pode ver os departamentos desta empresa."
        title="Sem permissão"
      />
    );
  }

  const pending =
    teamsQuery.isPending || (canListPeople && unassignedQuery.isPending);
  const failure =
    teamsQuery.error ?? (canListPeople ? unassignedQuery.error : null);
  const ready =
    teamsQuery.isSuccess && (!canListPeople || unassignedQuery.isSuccess);

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
          {canManageDepartments(auth.permissions) ? (
            <DepartmentCreateDialog onCreated={onCreated} />
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="min-w-0">
        <DepartmentAccordion
          actions={headerActions}
          failure={failure}
          onOpenChange={onOpenChange}
          openSections={openSections}
          pending={pending}
          ready={ready}
          teams={activeTeams}
          unassignedTotal={canListPeople ? (unassignedQuery.data?.total ?? 0) : 0}
        />
      </CardContent>
    </Card>
  );
}
