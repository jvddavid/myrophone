import { useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { type FormEvent, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { accessFailureText, updateTeamRequest, type TeamSummary } from './api';
import { invalidateMemberLists } from './member-queries';
import { DepartmentIconPicker } from './department-icon-picker';
import {
  departmentIconPayloadKey,
  selectedDepartmentIconKey,
} from './department-icons';

const dialogClassName =
  'max-h-[min(40rem,calc(100dvh-2rem))] w-[calc(100%-2rem)] min-w-0 overflow-x-hidden overflow-y-auto';

function DepartmentSettingsForm({
  team,
  onClose,
}: {
  team: TeamSummary;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description ?? '');
  const [icon, setIcon] = useState(() => selectedDepartmentIconKey(team.icon));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmedName = name.trim();
      const trimmedDescription = description.trim();

      if (trimmedName.length < 2) {
        setError('O nome precisa ter pelo menos 2 caracteres.');
        return;
      }

      if (trimmedDescription.length === 1) {
        setError('A descrição precisa ter pelo menos 2 caracteres, ou fique em branco.');
        return;
      }

      const iconKey = departmentIconPayloadKey(icon);

      if (!iconKey) {
        setError('Escolha um ícone da lista.');
        return;
      }

      setPending(true);
      setError(null);
      void updateTeamRequest(team.id, {
        name: trimmedName,
        description: trimmedDescription.length > 0 ? trimmedDescription : null,
        icon: iconKey,
      })
        .then(async () => {
          onClose();
          await invalidateMemberLists(queryClient);
        })
        .catch((reason: unknown) => {
          setError(accessFailureText(reason));
        })
        .finally(() => {
          setPending(false);
        });
    },
    [description, icon, name, onClose, queryClient, team.id],
  );

  return (
    <DialogContent className={dialogClassName}>
      <DialogHeader>
        <DialogTitle>Configurar departamento</DialogTitle>
        <DialogDescription>
          O nome é obrigatório. A descrição pode ficar em branco.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit}>
        <FieldGroup>
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor={`department-settings-name-${team.id}`}>Nome</FieldLabel>
            <Input
              id={`department-settings-name-${team.id}`}
              minLength={2}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`department-settings-description-${team.id}`}>
              Descrição
            </FieldLabel>
            <Textarea
              id={`department-settings-description-${team.id}`}
              onChange={(event) => setDescription(event.target.value)}
              value={description}
            />
            {error ? <FieldError>{error}</FieldError> : null}
          </Field>
          <DepartmentIconPicker
            labelId={`department-settings-icon-${team.id}`}
            onChange={setIcon}
            value={icon}
          />
          <Button disabled={pending} type="submit">
            <Save />
            {pending ? 'Aguarde…' : 'Salvar'}
          </Button>
        </FieldGroup>
      </form>
    </DialogContent>
  );
}

export function DepartmentSettingsDialog({
  team,
  open,
  onOpenChange,
}: {
  team: TeamSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const onClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      {open ? (
        <DepartmentSettingsForm
          key={`${team.id}:${team.name}:${team.description ?? ''}:${team.icon}`}
          onClose={onClose}
          team={team}
        />
      ) : null}
    </Dialog>
  );
}
