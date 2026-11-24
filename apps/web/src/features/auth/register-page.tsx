import { parseBrazilPhone } from '@myrophone/shared';
import { useNavigate } from '@tanstack/react-router';
import { type ChangeEvent, type FormEvent, useCallback, useState } from 'react';
import { IconInput } from '@/components/ui/icon-input';
import { Label } from '@/components/ui/label';
import { PhoneInput } from '@/components/ui/phone-input';
import { brazilPhoneInvalidMessage } from '@/lib/brazil-phone';
import { AuthRequestError, registerRequest } from './api';
import { AuthScreen } from './auth-screen';
import { registerPasswordError } from './register-form';
import { saveSession } from './session';

interface RegisterValues {
  name: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const emptyValues: RegisterValues = {
  name: '',
  phone: '',
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
  const onPhone = useCallback((phone: string) => {
    setValues((current) => ({ ...current, phone }));
  }, []);

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const passwordError = registerPasswordError(
        values.password,
        values.confirmPassword,
      );

      if (passwordError) {
        setError(passwordError);
        return;
      }

      const phone = parseBrazilPhone(values.phone);

      if (!phone) {
        setError(brazilPhoneInvalidMessage);
        return;
      }

      setPending(true);
      setError(null);

      void registerRequest({
        name: values.name.trim(),
        phone,
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
      description="Crie a conta para entrar no painel."
      error={error}
      alternateLabel="Entrar"
      alternatePrompt="Já tem conta?"
      alternateTo="/login"
      onSubmit={onSubmit}
      pending={pending}
      submitLabel="Criar conta"
      title="Criar conta"
    >
      <div className="space-y-2">
        <Label htmlFor="name">Seu nome</Label>
        <IconInput
          autoComplete="name"
          icon="person"
          id="name"
          minLength={2}
          name="name"
          onChange={onChange}
          required
          value={values.name}
        />
      </div>
      <PhoneInput id="phone" onChange={onPhone} required value={values.phone} />
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <IconInput
          autoComplete="email"
          icon="email"
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
        <IconInput
          autoComplete="new-password"
          icon="password"
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
        <IconInput
          autoComplete="new-password"
          icon="password"
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
