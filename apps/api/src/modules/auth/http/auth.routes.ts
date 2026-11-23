import { Elysia, t } from 'elysia';
import { AppError } from '../../../core/errors/app-error';
import { logger } from '../../../core/logger';
import { getRequestMeta } from '../request-meta';
import {
  createFirstCompany,
  loginWithPassword,
  logoutByRefreshToken,
  refreshAuthSession,
  registerAccount,
  requireAuthContext,
} from '../service';

const registerBodySchema = t.Object({
  name: t.String({ minLength: 2 }),
  phone: t.String({ minLength: 8, maxLength: 20 }),
  email: t.String({ format: 'email' }),
  password: t.String({ minLength: 8 }),
});

const loginBodySchema = t.Object({
  email: t.String({ format: 'email' }),
  password: t.String({ minLength: 8 }),
});

const refreshBodySchema = t.Object({
  refreshToken: t.String({ minLength: 10 }),
});

const createCompanyBodySchema = t.Object({
  name: t.String({ minLength: 2 }),
  refreshToken: t.String({ minLength: 10 }),
});

function toErrorResponse(
  error: unknown,
  status: (code: number, body: unknown) => unknown,
): unknown {
  if (error instanceof AppError) {
    return status(error.statusCode, {
      error: error.code,
      message: error.message,
      details: error.details,
    });
  }

  logger.error({ err: error }, 'Unexpected error in auth routes');
  return status(500, {
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error happened.',
  });
}

export const authRoutes = new Elysia()
  .post(
    '/auth/register',
    async ({ body, request, status }) => {
      try {
        const result = await registerAccount(body, getRequestMeta(request));
        return status(201, result);
      } catch (error) {
        return toErrorResponse(error, status);
      }
    },
    {
      body: registerBodySchema,
    },
  )
  .post(
    '/auth/login',
    async ({ body, request, status }) => {
      try {
        return await loginWithPassword(body, getRequestMeta(request));
      } catch (error) {
        return toErrorResponse(error, status);
      }
    },
    {
      body: loginBodySchema,
    },
  )
  .post(
    '/auth/companies',
    async ({ body, request, status }) => {
      try {
        const auth = await requireAuthContext(request);
        return await createFirstCompany(
          {
            userId: auth.user.id,
            sessionId: auth.sessionId,
            name: body.name,
            refreshToken: body.refreshToken,
          },
          getRequestMeta(request),
        );
      } catch (error) {
        return toErrorResponse(error, status);
      }
    },
    {
      body: createCompanyBodySchema,
    },
  )
  .post(
    '/auth/refresh',
    async ({ body, request, status }) => {
      try {
        return await refreshAuthSession(
          body.refreshToken,
          getRequestMeta(request),
        );
      } catch (error) {
        return toErrorResponse(error, status);
      }
    },
    {
      body: refreshBodySchema,
    },
  )
  .post(
    '/auth/logout',
    async ({ body, request, status }) => {
      try {
        const revoked = await logoutByRefreshToken(
          body.refreshToken,
          getRequestMeta(request),
        );

        return {
          revoked,
        };
      } catch (error) {
        return toErrorResponse(error, status);
      }
    },
    {
      body: refreshBodySchema,
    },
  )
  .get('/auth/me', async ({ request, status }) => {
    try {
      return await requireAuthContext(request);
    } catch (error) {
      return toErrorResponse(error, status);
    }
  });
