import { AppError } from '../../core/errors/app-error';
import { logger } from '../../core/logger';
import {
  assertUploadRules,
  buildObjectKey,
  sanitizeOriginalName,
  visibilityForPurpose,
} from './rules';
import type {
  FileRequestMeta,
  FileStorage,
  FilesDb,
  StoredFilePurpose,
  StoredFileRecord,
  StoredFileView,
} from './types';

export interface FilesDeps {
  db: FilesDb;
  storage: FileStorage;
  publicBucket: string;
  privateBucket: string;
}

export interface UploadStoredFileInput {
  tenantId: string;
  userId: string;
  purpose: StoredFilePurpose;
  originalName: string;
  contentType: string;
  bytes: Uint8Array;
  requestMeta?: FileRequestMeta;
}

export interface DeleteStoredFileInput {
  id: string;
  tenantId: string;
  userId: string;
  requestMeta?: FileRequestMeta;
}

function fileNotFound(): AppError {
  return new AppError({
    statusCode: 404,
    code: 'FILE_NOT_FOUND',
    message: 'File not found.',
  });
}

function storageUnavailable(): AppError {
  return new AppError({
    statusCode: 503,
    code: 'STORAGE_UNAVAILABLE',
    message: 'File storage is unavailable.',
  });
}

async function callStorage<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw storageUnavailable();
  }
}

function toView(record: StoredFileRecord, url: string): StoredFileView {
  return {
    id: record.id,
    tenantId: record.tenantId,
    uploadedByUserId: record.uploadedByUserId,
    purpose: record.purpose,
    visibility: record.visibility,
    originalName: record.originalName,
    contentType: record.contentType,
    sizeBytes: record.sizeBytes,
    createdAt: record.createdAt.toISOString(),
    url,
  };
}

export function createFilesService(deps: FilesDeps) {
  return {
    upload(input: UploadStoredFileInput): Promise<StoredFileView> {
      return uploadStoredFile(input, deps);
    },
    get(input: { id: string; tenantId: string }): Promise<StoredFileView> {
      return getStoredFile(input, deps);
    },
    delete(input: DeleteStoredFileInput): Promise<{
      id: string;
      deleted: true;
    }> {
      return deleteStoredFile(input, deps);
    },
    clearAvatar(input: {
      userId: string;
      tenantId: string | null;
      requestMeta?: FileRequestMeta;
    }): Promise<void> {
      return clearLinkedAvatar(input, deps);
    },
    clearLogo(input: {
      tenantId: string;
      userId: string;
      requestMeta?: FileRequestMeta;
    }): Promise<void> {
      return clearLinkedLogo(input, deps);
    },
  };
}

async function uploadStoredFile(
  input: UploadStoredFileInput,
  deps: FilesDeps,
): Promise<StoredFileView> {
  const visibility = visibilityForPurpose(input.purpose);
  const contentType = assertUploadRules({
    purpose: input.purpose,
    visibility,
    contentType: input.contentType,
    sizeBytes: input.bytes.byteLength,
  });
  const objectKey = buildObjectKey(input.tenantId);
  const bucket =
    visibility === 'PUBLIC' ? deps.publicBucket : deps.privateBucket;
  const stablePublicUrl = deps.storage.publicUrl(objectKey);

  await callStorage(() =>
    deps.storage.putObject({
      bucket,
      objectKey,
      bytes: input.bytes,
      contentType,
    }),
  );

  try {
    const record = await deps.db.saveUploadedFile({
      file: {
        tenantId: input.tenantId,
        uploadedByUserId: input.userId,
        visibility,
        purpose: input.purpose,
        bucket,
        objectKey,
        originalName: sanitizeOriginalName(input.originalName),
        contentType,
        sizeBytes: input.bytes.byteLength,
      },
      avatarUrl: input.purpose === 'AVATAR' ? stablePublicUrl : null,
      avatarUserId: input.purpose === 'AVATAR' ? input.userId : null,
      logoUrl: input.purpose === 'LOGO' ? stablePublicUrl : null,
      logoTenantId: input.purpose === 'LOGO' ? input.tenantId : null,
      log: {
        tenantId: input.tenantId,
        actorUserId: input.userId,
        action: 'files.upload',
        entityType: 'StoredFile',
        metadata: {
          purpose: input.purpose,
          visibility,
        },
        ipAddress: input.requestMeta?.ipAddress ?? null,
        userAgent: input.requestMeta?.userAgent ?? null,
      },
    });
    const url =
      visibility === 'PUBLIC'
        ? stablePublicUrl
        : await callStorage(() =>
            deps.storage.privateUrl({ bucket, objectKey }),
          );

    return toView(record, url);
  } catch (error) {
    if (error instanceof AppError && error.code === 'STORAGE_UNAVAILABLE') {
      throw error;
    }

    try {
      await deps.storage.deleteObject({ bucket, objectKey });
    } catch (deleteError) {
      logger.error(
        { err: deleteError, bucket, objectKey },
        'Failed to delete object after the database insert failed',
      );
    }

    throw error;
  }
}

async function getStoredFile(
  input: { id: string; tenantId: string },
  deps: FilesDeps,
): Promise<StoredFileView> {
  const record = await deps.db.findInTenant(input.id, input.tenantId);

  if (!record) {
    throw fileNotFound();
  }

  const url =
    record.visibility === 'PUBLIC'
      ? deps.storage.publicUrl(record.objectKey)
      : await callStorage(() =>
          deps.storage.privateUrl({
            bucket: record.bucket,
            objectKey: record.objectKey,
          }),
        );

  return toView(record, url);
}

async function deleteStoredFile(
  input: DeleteStoredFileInput,
  deps: FilesDeps,
): Promise<{ id: string; deleted: true }> {
  const record = await deps.db.findInTenant(input.id, input.tenantId);

  if (!record) {
    throw fileNotFound();
  }

  const publicUrl =
    record.visibility === 'PUBLIC'
      ? deps.storage.publicUrl(record.objectKey)
      : null;
  const avatarUrlToClear = record.purpose === 'AVATAR' ? publicUrl : null;
  const logoUrlToClear = record.purpose === 'LOGO' ? publicUrl : null;
  const deleted = await deps.db.deleteUploadedFile({
    id: record.id,
    tenantId: input.tenantId,
    avatarUrlToClear,
    logoUrlToClear,
    log: {
      tenantId: input.tenantId,
      actorUserId: input.userId,
      action: 'files.delete',
      entityType: 'StoredFile',
      metadata: {
        purpose: record.purpose,
        visibility: record.visibility,
      },
      ipAddress: input.requestMeta?.ipAddress ?? null,
      userAgent: input.requestMeta?.userAgent ?? null,
    },
  });

  if (!deleted) {
    throw fileNotFound();
  }

  await callStorage(() =>
    deps.storage.deleteObject({
      bucket: record.bucket,
      objectKey: record.objectKey,
    }),
  );

  return {
    id: record.id,
    deleted: true,
  };
}

function publicFileByUrl(
  files: StoredFileRecord[],
  deps: FilesDeps,
): Map<string, StoredFileRecord> {
  const byUrl = new Map<string, StoredFileRecord>();

  for (const file of files) {
    if (file.visibility !== 'PUBLIC') {
      continue;
    }

    byUrl.set(deps.storage.publicUrl(file.objectKey), file);
  }

  return byUrl;
}

async function clearLinkedAvatar(
  input: {
    userId: string;
    tenantId: string | null;
    requestMeta?: FileRequestMeta;
  },
  deps: FilesDeps,
): Promise<void> {
  const current = await deps.db.readUserAvatarUrl(input.userId);

  if (!current) {
    return;
  }

  const files = await deps.db.listStoredFiles({
    purpose: 'AVATAR',
    uploadedByUserId: input.userId,
  });
  const match = publicFileByUrl(files, deps).get(current);

  if (match) {
    await deleteStoredFile(
      {
        id: match.id,
        tenantId: match.tenantId,
        userId: input.userId,
        requestMeta: input.requestMeta,
      },
      deps,
    );
    return;
  }

  await deps.db.clearUserAvatarUrl(input.userId);
  await deps.db.writeActionLog(
    {
      tenantId: input.tenantId,
      actorUserId: input.userId,
      action: 'profile.avatar_clear',
      entityType: 'User',
      metadata: { purpose: 'AVATAR', visibility: 'PUBLIC' },
      ipAddress: input.requestMeta?.ipAddress ?? null,
      userAgent: input.requestMeta?.userAgent ?? null,
    },
    input.userId,
  );
}

async function clearLinkedLogo(
  input: {
    tenantId: string;
    userId: string;
    requestMeta?: FileRequestMeta;
  },
  deps: FilesDeps,
): Promise<void> {
  const current = await deps.db.readTenantLogoUrl(input.tenantId);

  if (!current) {
    return;
  }

  const files = await deps.db.listStoredFiles({
    purpose: 'LOGO',
    tenantId: input.tenantId,
  });
  const match = publicFileByUrl(files, deps).get(current);

  if (match) {
    await deleteStoredFile(
      {
        id: match.id,
        tenantId: match.tenantId,
        userId: input.userId,
        requestMeta: input.requestMeta,
      },
      deps,
    );
    return;
  }

  await deps.db.clearTenantLogoUrl(input.tenantId);
  await deps.db.writeActionLog(
    {
      tenantId: input.tenantId,
      actorUserId: input.userId,
      action: 'company.logo_clear',
      entityType: 'Tenant',
      metadata: { purpose: 'LOGO', visibility: 'PUBLIC' },
      ipAddress: input.requestMeta?.ipAddress ?? null,
      userAgent: input.requestMeta?.userAgent ?? null,
    },
    input.tenantId,
  );
}
