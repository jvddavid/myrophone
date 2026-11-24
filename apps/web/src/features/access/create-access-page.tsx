import { getRouteApi, Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { type ChangeEvent, type FormEvent, useCallback, useState } from 'react';
import { brazilPhoneDigits } from '@myrophone/shared';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  accessFailureText,
  createMemberRequest,
  listOwnedCompaniesRequest,
  type OwnedCompany,
} from './api';
import {
  createAccessFormError,
  initialCreateAccessSelection,
  selectDepartment,
  toCreateAccessBody,
  toggleOwnedCompany,
} from './create-access-form';
import { invalidateMemberLists } from './member-queries';
import { OwnerOnly } from './owner-only';

const authenticatedRoute = getRouteApi('/_authenticated');

export function CreateAccessPage() {
  const { auth } = authenticatedRoute.useRouteContext();
  const tenantId = auth.tenant?.id ?? null;
  const isOwner = tenantId !== null && auth.role === 'OWNER';
  const owned = useQuery({
    queryKey: ['owned-companies', tenantId],
    queryFn: listOwnedCompaniesRequest,
    enabled: isOwner,
  });

  if (!isOwner || !tenantId) {
    return <OwnerOnly />;
  }

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Criar acesso</CardTitle>
      </CardHeader>
      <CardContent className="min-w-0">
        {owned.isPending ? <Skeleton className="h-16 w-full" /> : null}
        {owned.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {accessFailureText(owned.error)}
          </p>
        ) : null}
        {owned.isSuccess ? (
          <CreateAccessForm
            companies={owned.data}
            key={tenantId}
            tenantId={tenantId}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function CreateAccessForm({
  companies,
  tenantId,
}: {
  companies: OwnedCompany[];
  tenantId: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selection, setSelection] = useState(() =>
    initialCreateAccessSelection(companies, tenantId),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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

  const onToggle = useCallback((company: OwnedCompany, checked: boolean) => {
    setSelection((current) => toggleOwnedCompany(current, company, checked));
  }, []);

  const onSelectTeam = useCallback((companyId: string, teamId: string) => {
    setSelection((current) => selectDepartment(current, companyId, teamId));
  }, []);

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formError = createAccessFormError({
        name,
        phone,
        password,
        selection,
        companies,
      });

      if (formError) {
        setError(formError);
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
          selection,
        }),
      )
        .then(() => {
          void invalidateMemberLists(queryClient);
          return navigate({ to: '/acessos' });
        })
        .catch((reason: unknown) => {
          setError(accessFailureText(reason));
          setPending(false);
        });
    },
    [companies, email, name, navigate, password, phone, queryClient, selection],
  );
  const selectedTenantIds = new Set(selection.tenantIds);

  return (
    <form noValidate onSubmit={onSubmit}>
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
        {companies.map((company) => (
          <CompanyChoice
            checked={selectedTenantIds.has(company.id)}
            company={company}
            key={company.id}
            onSelectTeam={onSelectTeam}
            onToggle={onToggle}
            teamId={selection.teamByTenant[company.id] ?? ''}
          />
        ))}
        {error ? <FieldError>{error}</FieldError> : null}
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/acessos">
              <ArrowLeft />
              Voltar
            </Link>
          </Button>
          <Button disabled={pending} type="submit">
            <UserPlus />
            {pending ? 'Aguarde…' : 'Criar acesso'}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

function CompanyChoice({
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
  const onChecked = useCallback(
    (value: boolean | 'indeterminate') => {
      onToggle(company, value === true);
    },
    [company, onToggle],
  );
  const onTeam = useCallback(
    (value: string) => {
      onSelectTeam(company.id, value);
    },
    [company.id, onSelectTeam],
  );
  const checkboxId = `company-${company.id}`;
  const departmentId = `department-${company.id}`;

  return (
    <Field>
      <div className="flex min-w-0 items-start gap-2">
        <Checkbox
          checked={checked}
          id={checkboxId}
          onCheckedChange={onChecked}
        />
        <FieldLabel className="break-words" htmlFor={checkboxId}>
          {company.name}
        </FieldLabel>
      </div>
      {checked ? (
        <Field>
          <FieldLabel htmlFor={departmentId}>
            Departamento em {company.name}
          </FieldLabel>
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
    </Field>
  );
}
