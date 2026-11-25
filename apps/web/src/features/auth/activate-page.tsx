import { getRouteApi, Link, useNavigate } from '@tanstack/react-router';
import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useCallback,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AuthRequestError,
  confirmEmailCodeRequest,
  resendActivationEmailRequest,
} from './api';
import { logoutSession } from './session';
import { needsEmailActivation } from './email-activation';

const activateRoute = getRouteApi('/ativar');

function ActivateFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            MyroPhone
          </p>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
      </Card>
    </main>
  );
}

function ActivationCodeForm({
  onError,
  onSuccess,
}: {
  onError: (message: string) => void;
  onSuccess: () => void;
}) {
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const onCode = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setCode(event.target.value.replace(/\D/g, '').slice(0, 6));
  }, []);

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setPending(true);
      onError('');

      void confirmEmailCodeRequest(code.trim())
        .then(() => {
          onSuccess();
        })
        .catch((reason: unknown) => {
          if (reason instanceof AuthRequestError) {
            onError(reason.message);
            return;
          }

          onError('Não foi possível confirmar o código.');
        })
        .finally(() => {
          setPending(false);
        });
    },
    [code, onError, onSuccess],
  );

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="activation-code">Código</Label>
        <Input
          autoComplete="one-time-code"
          id="activation-code"
          inputMode="numeric"
          maxLength={6}
          name="code"
          onChange={onCode}
          pattern="[0-9]{6}"
          required
          value={code}
        />
      </div>
      <Button className="w-full" disabled={pending || code.length !== 6} type="submit">
        {pending ? 'Aguarde…' : 'Confirmar código'}
      </Button>
    </form>
  );
}

function ResendActivationButton({
  onError,
  onSent,
}: {
  onError: (message: string) => void;
  onSent: () => void;
}) {
  const [pending, setPending] = useState(false);

  const onResend = useCallback(() => {
    setPending(true);

    void resendActivationEmailRequest()
      .then(() => {
        onSent();
      })
      .catch((reason: unknown) => {
        if (reason instanceof AuthRequestError) {
          onError(reason.message);
          return;
        }

        onError('Não foi possível reenviar o e-mail.');
      })
      .finally(() => {
        setPending(false);
      });
  }, [onError, onSent]);

  return (
    <Button
      className="w-full"
      disabled={pending}
      onClick={onResend}
      type="button"
      variant="outline"
    >
      {pending ? 'Enviando…' : 'Reenviar e-mail'}
    </Button>
  );
}

function ActivateTokenError({ message }: { message: string }) {
  return (
    <ActivateFrame
      description="Peça outro e-mail na tela de ativação depois de entrar."
      title="Link inválido"
    >
      <p className="text-sm text-destructive" role="alert">
        {message}
      </p>
      <Button asChild className="w-full">
        <Link to="/login">Ir para o login</Link>
      </Button>
    </ActivateFrame>
  );
}

function ActivateAccount({
  email,
  initialError,
}: {
  email: string;
  initialError: string | null;
}) {
  const navigate = useNavigate();
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState<string | null>(null);

  const onError = useCallback((message: string) => {
    setNotice(null);
    setError(message.length > 0 ? message : null);
  }, []);

  const onSuccess = useCallback(() => {
    void navigate({ to: '/' });
  }, [navigate]);

  const onSent = useCallback(() => {
    setError(null);
    setNotice('Enviamos outro e-mail com um novo link e um novo código.');
  }, []);

  const onLogout = useCallback(() => {
    void logoutSession().finally(() => {
      void navigate({ to: '/login' });
    });
  }, [navigate]);

  return (
    <ActivateFrame
      description={`Enviamos um link e um código para ${email}. Os dois valem por 30 minutos.`}
      title="Ative seu e-mail"
    >
      <ActivationCodeForm onError={onError} onSuccess={onSuccess} />
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
      <ResendActivationButton onError={onError} onSent={onSent} />
      <button
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        onClick={onLogout}
        type="button"
      >
        Sair
      </button>
    </ActivateFrame>
  );
}

export function ActivatePage() {
  const { auth, confirmError } = activateRoute.useRouteContext();

  if (!auth || !needsEmailActivation(auth)) {
    return (
      <ActivateTokenError
        message={confirmError ?? 'Não foi possível confirmar o e-mail.'}
      />
    );
  }

  return <ActivateAccount email={auth.user.email} initialError={confirmError} />;
}
