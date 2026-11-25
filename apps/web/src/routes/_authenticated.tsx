import { createFileRoute, redirect } from '@tanstack/react-router';
import { AuthenticatedLayout } from '../features/auth/authenticated-layout';
import { needsEmailActivation } from '../features/auth/email-activation';
import { ensureSession } from '../features/auth/session';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    const auth = await ensureSession();

    if (!auth) {
      throw redirect({ to: '/login' });
    }

    if (needsEmailActivation(auth)) {
      throw redirect({ to: '/ativar' });
    }

    return { auth };
  },
  component: AuthenticatedLayout,
});
