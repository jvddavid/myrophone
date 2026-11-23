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
}

const emptyValues: LoginValues = {
  email: '',
  password: '',
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

      void loginRequest({
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
      description="Entre com e-mail e senha."
      error={error}
      alternateLabel="Criar conta"
      alternatePrompt="Ainda não tem conta?"
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
    </AuthScreen>
  );
}
