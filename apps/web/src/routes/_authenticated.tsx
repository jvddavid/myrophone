import { createFileRoute, redirect } from '@tanstack/react-router';
import { AuthenticatedLayout } from '../features/auth/authenticated-layout';
import { ensureSession } from '../features/auth/session';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    const auth = await ensureSession();

    if (!auth) {
      throw redirect({ to: '/login' });
    }

    return { auth };
  },
  component: AuthenticatedLayout,
});
