import { getRouteApi } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { type ChangeEvent, type FormEvent, useCallback, useMemo, useState } from 'react';
import { brazilPhoneDigits } from '@myrophone/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { IconInput } from '@/components/ui/icon-input';
import { PhoneInput } from '@/components/ui/phone-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { CompanyMark } from '../auth/company-mark';
import {
  accessFailureText,
  createMemberRequest,
  listOwnedCompaniesRequest,
  type OwnedCompany,
} from './api';
import {
  createAccessCompaniesError,
  createAccessIdentityError,
  type CreateAccessSelection,
  initialCreateAccessSelection,
  selectDepartment,
  toCreateAccessBody,
  toggleOwnedCompany,
} from './create-access-form';
import { invalidateMemberLists } from './member-queries';

const authenticatedRoute = getRouteApi('/_authenticated');
const dialogClassName =
  'max-h-[min(40rem,calc(100dvh-2rem))] w-[calc(100%-2rem)] max-w-lg min-w-0 overflow-x-hidden overflow-y-auto';
const emptySelection: CreateAccessSelection = {
  tenantIds: [],
  teamByTenant: {},
};

type CreateStep = 'details' | 'companies';

export function CreateAccessDialog() {
  const { auth } = authenticatedRoute.useRouteContext();
  const tenantId = auth.tenant?.id ?? null;
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (next) {
      setSession((current) => current + 1);
    }
  }, []);

  const onCreated = useCallback(() => {
    setOpen(false);
  }, []);

  if (!tenantId) {
    return null;
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button type="button">
          <UserPlus />
          Criar acesso
        </Button>
      </DialogTrigger>
      <DialogContent className={dialogClassName}>
        <CreateAccessDialogBody
          key={session}
          onCreated={onCreated}
          tenantId={tenantId}
        />
      </DialogContent>
    </Dialog>
  );
}

function CreateAccessDialogBody({
  tenantId,
  onCreated,
}: {
  tenantId: string;
  onCreated: () => void;
}) {
  const queryClient = useQueryClient();
  const owned = useQuery({
    queryKey: ['owned-companies', tenantId],
    queryFn: listOwnedCompaniesRequest,
  });
  const [step, setStep] = useState<CreateStep>('details');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selection, setSelection] = useState<CreateAccessSelection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const companies = useMemo(() => owned.data ?? [], [owned.data]);
  const activeSelection =
    selection ??
    (owned.isSuccess
      ? initialCreateAccessSelection(companies, tenantId)
      : emptySelection);

  const onName = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
  }, []);
  const onPhone = useCallback((digits: string) => {
    setPhone(digits);
  }, []);
  const onEmail = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value);
  }, []);
  const onPassword = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
  }, []);

  const onToggle = useCallback(
    (company: OwnedCompany, checked: boolean) => {
      setSelection((current) =>
        toggleOwnedCompany(
          current ?? initialCreateAccessSelection(companies, tenantId),
          company,
          checked,
        ),
      );
    },
    [companies, tenantId],
  );

  const onSelectTeam = useCallback(
    (companyId: string, teamId: string) => {
      setSelection((current) =>
        selectDepartment(
          current ?? initialCreateAccessSelection(companies, tenantId),
          companyId,
          teamId,
        ),
      );
    },
    [companies, tenantId],
  );

  const onBack = useCallback(() => {
    setError(null);
    setStep('details');
  }, []);

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (step === 'details') {
        const identityError = createAccessIdentityError({ name, phone, password });
        setError(identityError);
        if (!identityError) {
          setStep('companies');
        }
        return;
      }

      const companiesError = createAccessCompaniesError({
        selection: activeSelection,
        companies,
      });

      if (companiesError) {
        setError(companiesError);
        return;
      }

      setPending(true);
      setError(null);
      void createMemberRequest(
        toCreateAccessBody({
          name,
          phone: brazilPhoneDigits(phone),
          email,
          password,
          selection: activeSelection,
        }),
      )
        .then(() => invalidateMemberLists(queryClient))
        .then(() => {
          onCreated();
        })
        .catch((reason: unknown) => {
          setError(accessFailureText(reason));
          setPending(false);
        });
    },
    [
      activeSelection,
      companies,
      email,
      name,
      onCreated,
      password,
      phone,
      queryClient,
      step,
    ],
  );

  return (
    <form className="grid min-w-0 gap-4" noValidate onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>Criar acesso</DialogTitle>
        <DialogDescription>
          {step === 'details'
            ? 'Passo 1 de 2. Dados da pessoa.'
            : 'Passo 2 de 2. Escolha as empresas.'}
        </DialogDescription>
      </DialogHeader>
      {step === 'details' ? (
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="accessName">Nome</FieldLabel>
            <IconInput
              autoComplete="name"
              icon="person"
              id="accessName"
              name="accessName"
              onChange={onName}
              value={name}
            />
          </Field>
          <PhoneInput id="accessPhone" name="accessPhone" onChange={onPhone} value={phone} />
          <Field>
            <FieldLabel htmlFor="accessEmail">E-mail</FieldLabel>
            <IconInput
              autoComplete="email"
              icon="email"
              id="accessEmail"
              name="accessEmail"
              onChange={onEmail}
              type="email"
              value={email}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="accessPassword">Senha</FieldLabel>
            <IconInput
              autoComplete="new-password"
              icon="password"
              id="accessPassword"
              name="accessPassword"
              onChange={onPassword}
              type="password"
              value={password}
            />
          </Field>
        </FieldGroup>
      ) : (
        <CompanyStep
          companies={companies}
          errorText={owned.isError ? accessFailureText(owned.error) : null}
          onSelectTeam={onSelectTeam}
          onToggle={onToggle}
          pending={owned.isPending}
          selection={activeSelection}
        />
      )}
      {error ? <FieldError>{error}</FieldError> : null}
      <DialogFooter className="gap-2 sm:space-x-0">
        {step === 'companies' ? (
          <Button onClick={onBack} type="button" variant="outline">
            Voltar
          </Button>
        ) : null}
        <Button disabled={pending || (step === 'companies' && owned.isPending)} type="submit">
          {step === 'details' ? null : <UserPlus />}
          {pending ? 'Aguarde…' : step === 'details' ? 'Continuar' : 'Criar acesso'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function CompanyStep({
  companies,
  pending,
  errorText,
  selection,
  onToggle,
  onSelectTeam,
}: {
  companies: OwnedCompany[];
  pending: boolean;
  errorText: string | null;
  selection: CreateAccessSelection;
  onToggle: (company: OwnedCompany, checked: boolean) => void;
  onSelectTeam: (companyId: string, teamId: string) => void;
}) {
  if (pending) {
    return <Skeleton className="h-16 w-full" />;
  }

  if (errorText) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {errorText}
      </p>
    );
  }

  if (companies.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma empresa.</p>;
  }

  const selectedTenantIds = new Set(selection.tenantIds);

  return (
    <ul className="flex min-w-0 flex-col gap-2">
      {companies.map((company) => (
        <CompanyBlock
          checked={selectedTenantIds.has(company.id)}
          company={company}
          key={company.id}
          onSelectTeam={onSelectTeam}
          onToggle={onToggle}
          teamId={selection.teamByTenant[company.id] ?? ''}
        />
      ))}
    </ul>
  );
}

function CompanyBlock({
  company,
  checked,
  teamId,
  onToggle,
  onSelectTeam,
}: {
  company: OwnedCompany;
  checked: boolean;
  teamId: string;
  onToggle: (company: OwnedCompany, checked: boolean) => void;
  onSelectTeam: (companyId: string, teamId: string) => void;
}) {
  const onPress = useCallback(() => {
    onToggle(company, !checked);
  }, [checked, company, onToggle]);
  const onTeam = useCallback(
    (value: string) => {
      onSelectTeam(company.id, value);
    },
    [company.id, onSelectTeam],
  );
  const departmentId = `department-${company.id}`;
  const description = company.description?.trim() || null;

  return (
    <li
      className={cn(
        'min-w-0 overflow-hidden rounded-lg border p-3',
        checked ? 'border-foreground/30 bg-muted' : 'bg-background',
      )}
    >
      <button
        aria-pressed={checked}
        className="flex w-full min-w-0 items-center gap-3 text-left"
        onClick={onPress}
        type="button"
      >
        <CompanyMark logoUrl={company.logoUrl} name={company.name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{company.name}</span>
          {description ? (
            <span className="block truncate text-sm text-muted-foreground">
              {description}
            </span>
          ) : null}
        </span>
      </button>
      {checked ? (
        <Field className="mt-3">
          <FieldLabel htmlFor={departmentId}>Departamento</FieldLabel>
          <Select onValueChange={onTeam} value={teamId || undefined}>
            <SelectTrigger className="w-full min-w-0" id={departmentId}>
              <SelectValue placeholder="Departamento" />
            </SelectTrigger>
            <SelectContent>
              {company.teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}
    </li>
  );
}
