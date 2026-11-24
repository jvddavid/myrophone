import { Plus, X } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { IconInput, IconTextarea } from '@/components/ui/icon-input';

export interface CompanyTextDraft {
  name: string;
  description: string;
}

export function CompanyCreateForm({
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  pending: boolean;
  error: string | null;
  onSubmit: (draft: CompanyTextDraft) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({ name: name.trim(), description: description.trim() });
  }

  return (
    <form onSubmit={submit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="newCompanyName">Nome</FieldLabel>
          <IconInput
            icon="company"
            id="newCompanyName"
            minLength={2}
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </Field>
        <Field data-invalid={Boolean(error)}>
          <FieldLabel htmlFor="newCompanyDescription">Descrição</FieldLabel>
          <IconTextarea
            icon="description"
            id="newCompanyDescription"
            maxLength={280}
            onChange={(event) => setDescription(event.target.value)}
            value={description}
          />
          {error ? <FieldError>{error}</FieldError> : null}
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending} type="submit">
            <Plus />
            {pending ? 'Salvando…' : 'Criar empresa'}
          </Button>
          <Button onClick={onCancel} type="button" variant="outline">
            <X />
            Cancelar
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
