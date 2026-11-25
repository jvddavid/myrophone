import { useCallback, useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  AccordionItemWithActions,
  type AccordionAction,
} from '@/components/ui/accordion-item-with-actions';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { accessFailureText, type TeamSummary } from './api';
import { DepartmentAddControl } from './department-add-control';
import {
  defaultDepartmentIcon,
  departmentIconByKey,
} from './department-icons';
import { DepartmentMemberList } from './department-member-list';
import { DepartmentSettingsDialog } from './department-settings-dialog';

const unassignedValue = 'none';

function DepartmentHeading({
  iconKey,
  name,
}: {
  iconKey: string;
  name: string;
}) {
  const entry = departmentIconByKey.get(iconKey) ?? defaultDepartmentIcon;
  const Icon = entry.icon;

  return (
    <span className="flex min-w-0 items-center gap-2">
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="min-w-0 break-words">{name}</span>
    </span>
  );
}

function NoDepartments() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>Nenhum departamento</EmptyTitle>
        <EmptyDescription>
          Esta empresa ainda não tem um departamento ativo.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function DepartmentSection({
  team,
  open,
  actions,
}: {
  team: TeamSummary;
  open: boolean;
  actions: readonly AccordionAction[];
}) {
  const [action, setAction] = useState<string | null>(null);
  const onAction = useCallback((type: string) => {
    setAction(type);
  }, []);
  const onOpenChange = useCallback((next: boolean) => {
    if (!next) {
      setAction(null);
    }
  }, []);
  const canAdd = actions.some((item) => item.type === 'add');
  const canConfigure = actions.some((item) => item.type === 'configure');

  return (
    <>
      <AccordionItemWithActions
        actions={actions}
        onAction={onAction}
        title={<DepartmentHeading iconKey={team.icon} name={team.name} />}
        value={team.id}
      >
        <div className="flex flex-col gap-3">
          {team.description ? (
            <p className="break-words text-sm text-muted-foreground">{team.description}</p>
          ) : null}
          {open ? <DepartmentMemberList key={team.id} teamId={team.id} /> : null}
        </div>
      </AccordionItemWithActions>
      {canAdd ? (
        <DepartmentAddControl
          onOpenChange={onOpenChange}
          open={action === 'add'}
          teamId={team.id}
        />
      ) : null}
      {canConfigure ? (
        <DepartmentSettingsDialog
          onOpenChange={onOpenChange}
          open={action === 'configure'}
          team={team}
        />
      ) : null}
    </>
  );
}

function UnassignedSection({ open }: { open: boolean }) {
  return (
    <AccordionItem value={unassignedValue}>
      <AccordionTrigger className="min-w-0 gap-2">
        <span className="min-w-0 flex-1 break-words text-left">Sem departamento</span>
      </AccordionTrigger>
      <AccordionContent>
        {open ? <DepartmentMemberList key={unassignedValue} teamId={null} /> : null}
      </AccordionContent>
    </AccordionItem>
  );
}

export function DepartmentAccordion({
  pending,
  failure,
  ready,
  teams,
  unassignedTotal,
  openSections,
  onOpenChange,
  actions,
}: {
  pending: boolean;
  failure: unknown;
  ready: boolean;
  teams: TeamSummary[];
  unassignedTotal: number;
  openSections: string[];
  onOpenChange: (value: string[]) => void;
  actions: readonly AccordionAction[];
}) {
  if (pending && !failure) {
    return <Skeleton className="h-16 w-full" />;
  }

  if (failure) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {accessFailureText(failure)}
      </p>
    );
  }

  if (ready && teams.length === 0 && unassignedTotal === 0) {
    return <NoDepartments />;
  }

  if (!ready) {
    return null;
  }

  const openIds = new Set(openSections);

  return (
    <Accordion
      className="min-w-0"
      onValueChange={onOpenChange}
      type="multiple"
      value={openSections}
    >
      {teams.map((team) => (
        <DepartmentSection
          actions={actions}
          key={team.id}
          open={openIds.has(team.id)}
          team={team}
        />
      ))}
      {unassignedTotal > 0 ? (
        <UnassignedSection open={openIds.has(unassignedValue)} />
      ) : null}
    </Accordion>
  );
}
