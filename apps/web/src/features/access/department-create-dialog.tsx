import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { type FormEvent, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { accessFailureText, createTeamRequest } from './api';
import { invalidateMemberLists } from './member-queries';
import { DepartmentIconPicker } from './department-icon-picker';
import {
  defaultDepartmentIcon,
  departmentIconPayloadKey,
} from './department-icons';

const dialogClassName =
  'max-h-[min(40rem,calc(100dvh-2rem))] w-[calc(100%-2rem)] min-w-0 overflow-x-hidden overflow-y-auto';

export function DepartmentCreateDialog({
  onCreated,
}: {
  onCreated: (teamId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState(defaultDepartmentIcon.key);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);

    if (!next) {
      setName('');
      setDescription('');
      setIcon(defaultDepartmentIcon.key);
      setError(null);
    }
  }, []);

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
      const body =
        trimmedDescription.length > 0
          ? { name: trimmedName, description: trimmedDescription, icon: iconKey }
          : { name: trimmedName, icon: iconKey };

      void createTeamRequest(body)
        .then(async (team) => {
          await invalidateMemberLists(queryClient);
          onCreated(team.id);
          setName('');
          setDescription('');
          setIcon(defaultDepartmentIcon.key);
          setOpen(false);
        })
        .catch((reason: unknown) => {
          setError(accessFailureText(reason));
        })
        .finally(() => {
          setPending(false);
        });
    },
    [description, icon, name, onCreated, queryClient],
  );

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button className="shrink-0" type="button">
          <Plus />
          Novo departamento
        </Button>
      </DialogTrigger>
      <DialogContent className={dialogClassName}>
        <DialogHeader>
          <DialogTitle>Novo departamento</DialogTitle>
          <DialogDescription>
            O nome é obrigatório. A descrição pode ficar em branco.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <FieldGroup>
            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor="departmentName">Nome</FieldLabel>
              <Input
                id="departmentName"
                minLength={2}
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="departmentDescription">Descrição</FieldLabel>
              <Textarea
                id="departmentDescription"
                onChange={(event) => setDescription(event.target.value)}
                value={description}
              />
              {error ? <FieldError>{error}</FieldError> : null}
            </Field>
            <DepartmentIconPicker
              labelId="department-create-icon"
              onChange={setIcon}
              value={icon}
            />
            <Button disabled={pending} type="submit">
              <Plus />
              {pending ? 'Aguarde…' : 'Criar'}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
