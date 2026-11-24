import { ArrowLeft, ImageOff, Save } from 'lucide-react';
import { type ChangeEvent, type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { IconInput, IconTextarea } from '@/components/ui/icon-input';
import { Input } from '@/components/ui/input';
import { CompanyMark } from './company-mark';
import type { CompanyTextDraft } from './company-create-form';

const imageAccept = 'image/jpeg,image/png,image/webp,image/gif';

export function CompanyEditForm({
  name,
  description,
  logoUrl,
  pending,
  error,
  onSubmit,
  onUploadLogo,
  onClearLogo,
  onCancel,
}: {
  name: string;
  description: string;
  logoUrl: string | null;
  pending: boolean;
  error: string | null;
  onSubmit: (draft: CompanyTextDraft) => void;
  onUploadLogo: (file: File) => void;
  onClearLogo: () => void;
  onCancel: () => void;
}) {
  const [nextName, setNextName] = useState(name);
  const [nextDescription, setNextDescription] = useState(description);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({
      name: nextName.trim(),
      description: nextDescription.trim(),
    });
  }

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (file) {
      onUploadLogo(file);
    }
  }

  return (
    <form onSubmit={submit}>
      <FieldGroup>
        <div className="flex items-center gap-3">
          <CompanyMark logoUrl={logoUrl} name={nextName || name} />
          <Field className="min-w-0 flex-1">
            <FieldLabel htmlFor="companyLogo">Logo</FieldLabel>
            <Input
              accept={imageAccept}
              disabled={pending}
              id="companyLogo"
              onChange={onFile}
              type="file"
            />
          </Field>
        </div>
        {logoUrl ? (
          <Button
            disabled={pending}
            onClick={onClearLogo}
            type="button"
            variant="outline"
          >
            <ImageOff />
            Remover logo
          </Button>
        ) : null}
        <Field>
          <FieldLabel htmlFor="editCompanyName">Nome</FieldLabel>
          <IconInput
            icon="company"
            id="editCompanyName"
            minLength={2}
            onChange={(event) => setNextName(event.target.value)}
            required
            value={nextName}
          />
        </Field>
        <Field data-invalid={Boolean(error)}>
          <FieldLabel htmlFor="editCompanyDescription">Descrição</FieldLabel>
          <IconTextarea
            icon="description"
            id="editCompanyDescription"
            maxLength={280}
            onChange={(event) => setNextDescription(event.target.value)}
            value={nextDescription}
          />
          {error ? <FieldError>{error}</FieldError> : null}
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending} type="submit">
            <Save />
            {pending ? 'Salvando…' : 'Salvar'}
          </Button>
          <Button onClick={onCancel} type="button" variant="outline">
            <ArrowLeft />
            Voltar
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
