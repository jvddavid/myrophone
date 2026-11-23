import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { companyDraft, type CompanyDraft } from './company-profile';

export function CreateCompanyForm({
  pending,
  error,
  onSubmit,
}: {
  pending: boolean;
  error: string | null;
  onSubmit: (draft: CompanyDraft) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const draft = companyDraft({ name, description, logoUrl });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(draft);
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Criar empresa</CardTitle>
        <CardDescription>
          Nome, descrição e logo da primeira empresa desta conta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="companyName">Nome</FieldLabel>
              <Input
                id="companyName"
                minLength={2}
                name="companyName"
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </Field>
            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor="companyDescription">Descrição</FieldLabel>
              <Textarea
                id="companyDescription"
                maxLength={280}
                minLength={2}
                name="companyDescription"
                onChange={(event) => setDescription(event.target.value)}
                required
                value={description}
              />
              {error ? <FieldError>{error}</FieldError> : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="companyLogoUrl">Logo</FieldLabel>
              <Input
                id="companyLogoUrl"
                inputMode="url"
                name="companyLogoUrl"
                onChange={(event) => setLogoUrl(event.target.value)}
                placeholder="https://"
                type="url"
                value={logoUrl}
              />
            </Field>
            <Button disabled={pending} type="submit">
              {pending ? 'Aguarde…' : 'Criar empresa'}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
