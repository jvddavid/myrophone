import { Elysia, t } from 'elysia';
import { AppError } from '../../../core/errors/app-error';
import { logger } from '../../../core/logger';
import {
  confirmEmailCode,
  confirmEmailToken,
  issueEmailActivation,
} from '../../email/activation';
import { createPrismaEmailActivationStore } from '../../email/activation-store';
import { resolveEmailDelivery } from '../../email/email-config';
import { transportFor } from '../../email/mailer';
import { getFilesService } from '../../files/runtime';
import { getRequestMeta } from '../request-meta';
import {
  createFirstCompany,
  loginWithPassword,
  logoutByRefreshToken,
  openSessionForUserId,
  refreshAuthSession,
  registerAccount,
  requireAuthContext,
  switchCompany,
  updateOwnProfile,
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
  description: t.String({ minLength: 2, maxLength: 280 }),
  logoUrl: t.Optional(t.String({ maxLength: 2048 })),
  refreshToken: t.String({ minLength: 10 }),
});

const switchCompanyBodySchema = t.Object({
  tenantId: t.String({ minLength: 1 }),
  refreshToken: t.String({ minLength: 10 }),
});

const confirmEmailBodySchema = t.Object({
  token: t.String({ minLength: 10 }),
});

const confirmEmailCodeBodySchema = t.Object({
  code: t.String({ minLength: 6, maxLength: 6 }),
});

const updateProfileBodySchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 120 }),
  phone: t.String({ minLength: 1, maxLength: 40 }),
  email: t.Optional(t.String()),
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
            description: body.description,
            logoUrl: body.logoUrl,
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
    '/auth/tenant',
    async ({ body, request, status }) => {
      try {
        const auth = await requireAuthContext(request);
        return await switchCompany(
          {
            userId: auth.user.id,
            sessionId: auth.sessionId,
            tenantId: body.tenantId,
            refreshToken: body.refreshToken,
          },
          getRequestMeta(request),
        );
      } catch (error) {
        return toErrorResponse(error, status);
      }
    },
    {
      body: switchCompanyBodySchema,
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
  .post(
    '/auth/email/confirm',
    async ({ body, request, status }) => {
      try {
        const confirmed = await confirmEmailToken({
          token: body.token,
          store: await createPrismaEmailActivationStore(),
        });
        return await openSessionForUserId(
          confirmed.userId,
          getRequestMeta(request),
        );
      } catch (error) {
        return toErrorResponse(error, status);
      }
    },
    {
      body: confirmEmailBodySchema,
    },
  )
  .post(
    '/auth/email/code',
    async ({ body, request, status }) => {
      try {
        const auth = await requireAuthContext(request, {
          allowUnverifiedEmail: true,
        });
        await confirmEmailCode({
          userId: auth.user.id,
          code: body.code,
          store: await createPrismaEmailActivationStore(),
        });
        return await requireAuthContext(request, {
          allowUnverifiedEmail: true,
        });
      } catch (error) {
        return toErrorResponse(error, status);
      }
    },
    {
      body: confirmEmailCodeBodySchema,
    },
  )
  .post('/auth/email/resend', async ({ request, status }) => {
    try {
      const auth = await requireAuthContext(request, {
        allowUnverifiedEmail: true,
      });
      const delivery = resolveEmailDelivery();

      if (!delivery.enabled) {
        throw new AppError({
          statusCode: 404,
          code: 'EMAIL_DELIVERY_DISABLED',
          message: 'Email activation is not enabled.',
        });
      }

      if (auth.user.emailVerifiedAt) {
        return { sent: false };
      }

      await issueEmailActivation({
        user: {
          id: auth.user.id,
          email: auth.user.email,
          name: auth.user.name,
        },
        store: await createPrismaEmailActivationStore(),
        delivery,
        transport: transportFor(delivery.apiKey),
      });

      return { sent: true };
    } catch (error) {
      return toErrorResponse(error, status);
    }
  })
  .get('/auth/me', async ({ request, status }) => {
    try {
      return await requireAuthContext(request, { allowUnverifiedEmail: true });
    } catch (error) {
      return toErrorResponse(error, status);
    }
  })
  .patch(
    '/auth/me',
    async ({ body, request, status }) => {
      try {
        const auth = await requireAuthContext(request);
        await updateOwnProfile(
          {
            userId: auth.user.id,
            name: body.name,
            phone: body.phone,
            tenantId: auth.tenant?.id ?? null,
          },
          getRequestMeta(request),
        );
        return await requireAuthContext(request);
      } catch (error) {
        return toErrorResponse(error, status);
      }
    },
    {
      body: updateProfileBodySchema,
    },
  )
  .delete('/auth/me/avatar', async ({ request, status }) => {
    try {
      const auth = await requireAuthContext(request);
      const files = await getFilesService();
      await files.clearAvatar({
        userId: auth.user.id,
        tenantId: auth.tenant?.id ?? null,
        requestMeta: getRequestMeta(request),
      });
      return await requireAuthContext(request);
    } catch (error) {
      return toErrorResponse(error, status);
    }
  });
