import { useNavigate } from '@tanstack/react-router';
import { type ChangeEvent, type FormEvent, useCallback, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginRequest, AuthRequestError } from './api';
import { AuthScreen } from './auth-screen';
import { saveSession } from './session';

interface LoginValues {
  email: string;
  password: string;
  tenantSlug: string;
}

const emptyValues: LoginValues = {
  email: '',
  password: '',
  tenantSlug: '',
};

export function LoginPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState(emptyValues);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }, []);

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setPending(true);
      setError(null);

      const tenantSlug = values.tenantSlug.trim();

      void loginRequest({
        email: values.email.trim(),
        password: values.password,
        tenantSlug: tenantSlug || undefined,
      })
        .then((session) => {
          saveSession(session);
          return navigate({ to: '/' });
        })
        .catch((reason: unknown) => {
          if (reason instanceof AuthRequestError) {
            setError(reason.message);
            return;
          }

          setError('Não foi possível entrar.');
        })
        .finally(() => {
          setPending(false);
        });
    },
    [navigate, values],
  );

  return (
    <AuthScreen
      description="Entre com a conta da empresa para acessar o painel."
      error={error}
      alternateLabel="Criar conta"
      alternatePrompt="Ainda não tem empresa?"
      alternateTo="/register"
      onSubmit={onSubmit}
      pending={pending}
      submitLabel="Entrar"
      title="Entrar"
    >
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          autoComplete="email"
          id="email"
          name="email"
          onChange={onChange}
          required
          type="email"
          value={values.email}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input
          autoComplete="current-password"
          id="password"
          minLength={8}
          name="password"
          onChange={onChange}
          required
          type="password"
          value={values.password}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tenantSlug">Empresa</Label>
        <Input
          autoComplete="organization"
          id="tenantSlug"
          name="tenantSlug"
          onChange={onChange}
          placeholder="Obrigatório se a conta tiver mais de uma empresa"
          value={values.tenantSlug}
        />
      </div>
    </AuthScreen>
  );
}
