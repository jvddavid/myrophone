import { Elysia, t } from 'elysia';
import { AppError } from '../../../core/errors/app-error';
import { logger } from '../../../core/logger';
import { assertTenantPermission } from '../../auth/company-permission-store';
import { getRequestMeta } from '../../auth/request-meta';
import { requireAuthContext, requireTenantContext } from '../../auth/service';
import { isStoredFilePurpose } from '../rules';
import { getFilesService } from '../runtime';
import type { StoredFilePurpose } from '../types';

const fileParamsSchema = t.Object({
  id: t.String({ minLength: 1 }),
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

  logger.error({ err: error }, 'Unexpected error in file routes');
  return status(500, {
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error happened.',
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function readUpload(
  request: Request,
  parsedBody: unknown,
): Promise<{
  purpose: StoredFilePurpose;
  tenantId: string | null;
  originalName: string;
  contentType: string;
  bytes: Uint8Array;
}> {
  if (
    isRecord(parsedBody) &&
    ('purpose' in parsedBody || 'file' in parsedBody)
  ) {
    return readUploadFields(parsedBody);
  }

  let form: { get(name: string): unknown };

  try {
    form = await request.formData();
  } catch {
    throw new AppError({
      statusCode: 422,
      code: 'VALIDATION_ERROR',
      message: 'Expected multipart form data.',
    });
  }

  const tenantValue = form.get('tenantId');

  return readUploadFields({
    purpose: form.get('purpose'),
    file: form.get('file'),
    tenantId: typeof tenantValue === 'string' ? tenantValue : null,
  });
}

async function readUploadFields(fields: Record<string, unknown>): Promise<{
  purpose: StoredFilePurpose;
  tenantId: string | null;
  originalName: string;
  contentType: string;
  bytes: Uint8Array;
}> {
  const purposeValue = fields.purpose;
  const purpose = typeof purposeValue === 'string' ? purposeValue.trim() : '';

  if (!isStoredFilePurpose(purpose)) {
    throw new AppError({
      statusCode: 422,
      code: 'INVALID_PURPOSE',
      message: 'Purpose is invalid.',
    });
  }

  const fileValue = fields.file;

  if (!(fileValue instanceof Blob)) {
    throw new AppError({
      statusCode: 422,
      code: 'FILE_REQUIRED',
      message: 'A file is required.',
    });
  }

  const tenantValue = fields.tenantId;

  return {
    purpose,
    tenantId:
      typeof tenantValue === 'string' && tenantValue.trim().length > 0
        ? tenantValue.trim()
        : null,
    originalName: fileValue instanceof File ? fileValue.name : 'arquivo',
    contentType: fileValue.type,
    bytes: new Uint8Array(await fileValue.arrayBuffer()),
  };
}

export const filesRoutes = new Elysia()
  .post('/files', async ({ request, body, status }) => {
    try {
      const auth = requireTenantContext(await requireAuthContext(request));
      const upload = await readUpload(request, body);
      let tenantId = auth.tenant.id;

      if (upload.purpose === 'LOGO') {
        if (!upload.tenantId) {
          throw new AppError({
            statusCode: 422,
            code: 'VALIDATION_ERROR',
            message: 'A logo upload needs the company id.',
          });
        }

        await assertTenantPermission(
          auth.user.id,
          upload.tenantId,
          'tenant.manage',
        );
        tenantId = upload.tenantId;
      }

      const service = await getFilesService();
      const file = await service.upload({
        tenantId,
        userId: auth.user.id,
        purpose: upload.purpose,
        originalName: upload.originalName,
        contentType: upload.contentType,
        bytes: upload.bytes,
        requestMeta: getRequestMeta(request),
      });

      return status(201, file);
    } catch (error) {
      return toErrorResponse(error, status);
    }
  })
  .get(
    '/files/:id',
    async ({ params, request, status }) => {
      try {
        const auth = requireTenantContext(await requireAuthContext(request));
        const service = await getFilesService();

        return await service.get({
          id: params.id,
          tenantId: auth.tenant.id,
        });
      } catch (error) {
        return toErrorResponse(error, status);
      }
    },
    {
      params: fileParamsSchema,
    },
  )
  .delete(
    '/files/:id',
    async ({ params, request, status }) => {
      try {
        const auth = requireTenantContext(await requireAuthContext(request));
        const service = await getFilesService();

        return await service.delete({
          id: params.id,
          tenantId: auth.tenant.id,
          userId: auth.user.id,
          requestMeta: getRequestMeta(request),
        });
      } catch (error) {
        return toErrorResponse(error, status);
      }
    },
    {
      params: fileParamsSchema,
    },
  );
