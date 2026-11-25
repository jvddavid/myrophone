import { createFileRoute, redirect } from '@tanstack/react-router';
import { LoginPage } from '../features/auth/login-page';
import { needsEmailActivation } from '../features/auth/email-activation';
import { ensureSession } from '../features/auth/session';

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    const auth = await ensureSession();

    if (auth) {
      throw redirect({ to: needsEmailActivation(auth) ? '/ativar' : '/' });
    }
  },
  component: LoginPage,
});
