import { createFileRoute, redirect } from '@tanstack/react-router';
import { RegisterPage } from '../features/auth/register-page';
import { ensureSession } from '../features/auth/session';

export const Route = createFileRoute('/register')({
  beforeLoad: async () => {
    const auth = await ensureSession();

    if (auth) {
      throw redirect({ to: '/' });
    }
  },
  component: RegisterPage,
});
