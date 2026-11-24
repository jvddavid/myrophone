import { asType, type PrismaDb } from '../auth/db-types';
import type {
  FileActionLogInput,
  FilesDb,
  NewStoredFile,
  StoredFileRecord,
} from './types';

export function createPrismaFilesDb(db: PrismaDb): FilesDb {
  return {
    async saveUploadedFile(input) {
      return db.$transaction(async (tx) => {
        const created = asType<StoredFileRecord>(
          await tx.storedFile.create({
            data: storedFileData(input.file),
          }),
        );

        if (input.avatarUrl && input.avatarUserId) {
          await tx.user.update({
            where: { id: input.avatarUserId },
            data: { avatarUrl: input.avatarUrl },
          });
        }

        if (input.logoUrl && input.logoTenantId) {
          await tx.tenant.update({
            where: { id: input.logoTenantId },
            data: { logoUrl: input.logoUrl },
          });
        }

        await tx.actionLog.create({
          data: actionLogData(input.log, created.id),
        });

        return created;
      });
    },

    async findInTenant(id, tenantId) {
      return asType<StoredFileRecord | null>(
        await db.storedFile.findFirst({
          where: { id, tenantId },
        }),
      );
    },

    async deleteUploadedFile(input) {
      return db.$transaction(async (tx) => {
        const existing = asType<StoredFileRecord | null>(
          await tx.storedFile.findFirst({
            where: {
              id: input.id,
              tenantId: input.tenantId,
            },
          }),
        );

        if (!existing) {
          return null;
        }

        if (input.avatarUrlToClear) {
          const matches = asType<Array<{ id: string }>>(
            await tx.user.findMany({
              where: { avatarUrl: input.avatarUrlToClear },
              select: { id: true },
            }),
          );

          for (const match of matches) {
            await tx.user.update({
              where: { id: match.id },
              data: { avatarUrl: null },
            });
          }
        }

        if (input.logoUrlToClear) {
          const tenant = asType<{ id: string; logoUrl: string | null } | null>(
            await tx.tenant.findUnique({
              where: { id: input.tenantId },
              select: { id: true, logoUrl: true },
            }),
          );

          if (tenant?.logoUrl === input.logoUrlToClear) {
            await tx.tenant.update({
              where: { id: tenant.id },
              data: { logoUrl: null },
            });
          }
        }

        await tx.storedFile.deleteMany({
          where: {
            id: input.id,
            tenantId: input.tenantId,
          },
        });

        await tx.actionLog.create({
          data: actionLogData(input.log, existing.id),
        });

        return existing;
      });
    },

    async readUserAvatarUrl(userId) {
      const user = asType<{ avatarUrl: string | null } | null>(
        await db.user.findUnique({
          where: { id: userId },
          select: { avatarUrl: true },
        }),
      );

      return user?.avatarUrl ?? null;
    },

    async readTenantLogoUrl(tenantId) {
      const tenant = asType<{ logoUrl: string | null } | null>(
        await db.tenant.findUnique({
          where: { id: tenantId },
          select: { logoUrl: true },
        }),
      );

      return tenant?.logoUrl ?? null;
    },

    async listStoredFiles(input) {
      return asType<StoredFileRecord[]>(
        await db.storedFile.findMany({
          where: {
            purpose: input.purpose,
            ...(input.tenantId ? { tenantId: input.tenantId } : {}),
            ...(input.uploadedByUserId
              ? { uploadedByUserId: input.uploadedByUserId }
              : {}),
          },
        }),
      );
    },

    async clearUserAvatarUrl(userId) {
      await db.user.update({
        where: { id: userId },
        data: { avatarUrl: null },
      });
    },

    async clearTenantLogoUrl(tenantId) {
      await db.tenant.update({
        where: { id: tenantId },
        data: { logoUrl: null },
      });
    },

    async writeActionLog(log, entityId) {
      await db.actionLog.create({
        data: actionLogData(log, entityId),
      });
    },
  };
}

function storedFileData(file: NewStoredFile): Record<string, unknown> {
  return {
    tenantId: file.tenantId,
    uploadedByUserId: file.uploadedByUserId,
    visibility: file.visibility,
    purpose: file.purpose,
    bucket: file.bucket,
    objectKey: file.objectKey,
    originalName: file.originalName,
    contentType: file.contentType,
    sizeBytes: file.sizeBytes,
  };
}

function actionLogData(
  log: FileActionLogInput,
  entityId: string | null,
): Record<string, unknown> {
  return {
    tenantId: log.tenantId,
    actorUserId: log.actorUserId,
    action: log.action,
    entityType: log.entityType,
    entityId,
    metadata: log.metadata,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
  };
}
