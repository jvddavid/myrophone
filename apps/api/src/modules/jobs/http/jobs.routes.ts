import { Elysia, t } from 'elysia';
import { AppError } from '../../../core/errors/app-error';
import { logger } from '../../../core/logger';
import { ensurePermission, requireAuthContext } from '../../auth/service';
import {
  enqueueTenantHierarchyExportJob,
  getTenantHierarchyExportFile,
  getTenantHierarchyExportJobStatus,
} from '../hierarchy-export';

const jobIdParamsSchema = t.Object({
  jobId: t.String({ minLength: 1 }),
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

  logger.error({ err: error }, 'Unexpected error in jobs routes');
  return status(500, {
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error happened.',
  });
}

export const jobsRoutes = new Elysia()
  .post('/jobs/tenant-hierarchy-export', async ({ request, status }) => {
    try {
      const auth = await requireAuthContext(request);
      ensurePermission(auth, 'users.read');
      ensurePermission(auth, 'teams.read');

      const job = await enqueueTenantHierarchyExportJob({
        tenantId: auth.tenant.id,
        tenantSlug: auth.tenant.slug,
        tenantName: auth.tenant.name,
        requestedByUserId: auth.user.id,
      });

      return status(202, job);
    } catch (error) {
      return toErrorResponse(error, status);
    }
  })
  .get(
    '/jobs/tenant-hierarchy-export/:jobId',
    async ({ params, request, status }) => {
      try {
        const auth = await requireAuthContext(request);
        ensurePermission(auth, 'users.read');
        ensurePermission(auth, 'teams.read');

        return await getTenantHierarchyExportJobStatus({
          tenantId: auth.tenant.id,
          jobId: params.jobId,
        });
      } catch (error) {
        return toErrorResponse(error, status);
      }
    },
    {
      params: jobIdParamsSchema,
    },
  )
  .get(
    '/jobs/tenant-hierarchy-export/:jobId/file',
    async ({ params, request, status }) => {
      try {
        const auth = await requireAuthContext(request);
        ensurePermission(auth, 'users.read');
        ensurePermission(auth, 'teams.read');

        const file = await getTenantHierarchyExportFile({
          tenantId: auth.tenant.id,
          jobId: params.jobId,
        });

        return new Response(file.bytes, {
          status: 200,
          headers: {
            'content-type': file.mimeType,
            'content-disposition': `attachment; filename="${file.fileName}"`,
            'cache-control': 'no-store',
          },
        });
      } catch (error) {
        return toErrorResponse(error, status);
      }
    },
    {
      params: jobIdParamsSchema,
    },
  );
