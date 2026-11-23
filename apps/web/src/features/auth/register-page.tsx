import { useNavigate } from '@tanstack/react-router';
import { type ChangeEvent, type FormEvent, useCallback, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthRequestError, registerRequest } from './api';
import { AuthScreen } from './auth-screen';
import { saveSession } from './session';

interface RegisterValues {
  tenantName: string;
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const emptyValues: RegisterValues = {
  tenantName: '',
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
};

export function RegisterPage() {
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

      if (values.password !== values.confirmPassword) {
        setError('As senhas não coincidem.');
        return;
      }

      setPending(true);
      setError(null);

      void registerRequest({
        tenantName: values.tenantName.trim(),
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
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

          setError('Não foi possível criar a conta.');
        })
        .finally(() => {
          setPending(false);
        });
    },
    [navigate, values],
  );

  return (
    <AuthScreen
      description="Crie a empresa e a conta de proprietário."
      error={error}
      alternateLabel="Entrar"
      alternatePrompt="Já tem conta?"
      alternateTo="/login"
      onSubmit={onSubmit}
      pending={pending}
      submitLabel="Criar conta"
      title="Criar empresa"
    >
      <div className="space-y-2">
        <Label htmlFor="tenantName">Empresa</Label>
        <Input
          autoComplete="organization"
          id="tenantName"
          minLength={2}
          name="tenantName"
          onChange={onChange}
          required
          value={values.tenantName}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Seu nome</Label>
        <Input
          autoComplete="name"
          id="name"
          minLength={2}
          name="name"
          onChange={onChange}
          required
          value={values.name}
        />
      </div>
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
          autoComplete="new-password"
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
        <Label htmlFor="confirmPassword">Confirmar senha</Label>
        <Input
          autoComplete="new-password"
          id="confirmPassword"
          minLength={8}
          name="confirmPassword"
          onChange={onChange}
          required
          type="password"
          value={values.confirmPassword}
        />
      </div>
    </AuthScreen>
  );
}
