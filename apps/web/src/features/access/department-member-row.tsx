import { useQueryClient } from '@tanstack/react-query';
import { UserMinus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { AlertDialog, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';
import { accessFailureText, removeTeamMemberRequest, type CompanyMember } from './api';
import { MemberAvatar } from './member-avatar';
import { invalidateMemberLists } from './member-queries';
import { RemovalConfirmDialog } from './removal-confirm-dialog';

export function DepartmentMemberRow({
  member,
  teamId,
}: {
  member: CompanyMember;
  teamId: string | null;
}) {
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
    if (!teamId) {
      return;
    }

    setPending(true);
    setError(null);
    void removeTeamMemberRequest(teamId, member.userId)
      .then(async () => {
        setOpen(false);
        await invalidateMemberLists(queryClient);
      })
      .catch((reason: unknown) => {
        setError(accessFailureText(reason));
      })
      .finally(() => {
        setPending(false);
      });
  }, [member.userId, queryClient, teamId]);

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
      {teamId ? (
        <ItemActions className="ml-auto w-full shrink-0 flex-wrap justify-end sm:w-auto">
          <AlertDialog onOpenChange={onOpenChange} open={open}>
            <AlertDialogTrigger asChild>
              <Button
                aria-label={`Remover ${member.name} do departamento`}
                size="sm"
                type="button"
                variant="destructive"
              >
                <UserMinus />
                Remover
              </Button>
            </AlertDialogTrigger>
            <RemovalConfirmDialog
              confirmIcon={UserMinus}
              confirmLabel="Remover do departamento"
              description={`${member.name} sai deste departamento e continua nesta empresa.`}
              error={error}
              onConfirm={onRemove}
              pending={pending}
              title="Remover do departamento"
            />
          </AlertDialog>
        </ItemActions>
      ) : null}
    </Item>
  );
}
