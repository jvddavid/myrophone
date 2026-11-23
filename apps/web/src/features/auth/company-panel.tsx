import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function showCreateCompany(
  tenant: { id: string; slug: string; name: string } | null,
): boolean {
  return tenant === null;
}

export function CreateCompanyForm({
  pending,
  error,
  onSubmit,
}: {
  pending: boolean;
  error: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Criar empresa</h1>
        <p className="text-muted-foreground">
          Esta conta ainda não tem uma empresa. Crie a primeira para abrir o painel.
        </p>
      </header>
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="companyName">Empresa</Label>
          <Input id="companyName" minLength={2} name="companyName" required />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button disabled={pending} type="submit">
          Criar empresa
        </Button>
      </form>
    </main>
  );
}
