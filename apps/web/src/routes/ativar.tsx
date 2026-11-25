import { createFileRoute, isRedirect, redirect } from '@tanstack/react-router';
import { ActivatePage } from '../features/auth/activate-page';
import { AuthRequestError, confirmEmailTokenRequest } from '../features/auth/api';
import { needsEmailActivation } from '../features/auth/email-activation';
import { ensureSession, saveSession } from '../features/auth/session';

interface ActivateSearch {
  token?: string;
}

export const Route = createFileRoute('/ativar')({
  validateSearch: (search: Record<string, unknown>): ActivateSearch => ({
    token:
      typeof search.token === 'string' && search.token.length > 0
        ? search.token
        : undefined,
  }),
  beforeLoad: async ({ search }) => {
    if (search.token) {
      try {
        const session = await confirmEmailTokenRequest(search.token);
        saveSession(session);
        throw redirect({ to: '/' });
      } catch (error) {
        if (isRedirect(error)) {
          throw error;
        }

        const auth = await ensureSession();
        const confirmError =
          error instanceof AuthRequestError
            ? error.message
            : 'Não foi possível confirmar o e-mail.';

        return { auth, confirmError };
      }
    }

    const auth = await ensureSession();

    if (!auth) {
      throw redirect({ to: '/login' });
    }

    if (!needsEmailActivation(auth)) {
      throw redirect({ to: '/' });
    }

    return { auth, confirmError: null as string | null };
  },
  component: ActivatePage,
});
