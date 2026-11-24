import { describe, expect, it } from 'vitest';
import { createFilesService, type FilesDeps } from './service';
import type {
  FileActionLogInput,
  FileStorage,
  FilesDb,
  StoredFileRecord,
} from './types';

const publicBase = 'http://127.0.0.1:9000/myrophone-public';

interface MemoryUser {
  id: string;
  avatarUrl: string | null;
}

interface MemoryTenant {
  id: string;
  logoUrl: string | null;
}

interface MemoryLog extends FileActionLogInput {
  entityId: string | null;
}

function createMemoryDb() {
  const files: StoredFileRecord[] = [];
  const users = new Map<string, MemoryUser>();
  const tenants = new Map<string, MemoryTenant>();
  const logs: MemoryLog[] = [];
  let failSave = false;

  const db: FilesDb = {
    async saveUploadedFile(input) {
      if (failSave) {
        failSave = false;
        throw new Error('insert failed');
      }

      const record: StoredFileRecord = {
        id: `file-${files.length + 1}`,
        createdAt: new Date('2026-11-23T18:00:00.000Z'),
        ...input.file,
      };
      files.push(record);

      if (input.avatarUrl && input.avatarUserId) {
        const user = users.get(input.avatarUserId) ?? {
          id: input.avatarUserId,
          avatarUrl: null,
        };
        user.avatarUrl = input.avatarUrl;
        users.set(user.id, user);
      }

      if (input.logoUrl && input.logoTenantId) {
        const tenant = tenants.get(input.logoTenantId) ?? {
          id: input.logoTenantId,
          logoUrl: null,
        };
        tenant.logoUrl = input.logoUrl;
        tenants.set(tenant.id, tenant);
      }

      logs.push({ ...input.log, entityId: record.id });
      return record;
    },
    async findInTenant(id, tenantId) {
      return (
        files.find((file) => file.id === id && file.tenantId === tenantId) ??
        null
      );
    },
    async deleteUploadedFile(input) {
      const index = files.findIndex(
        (file) => file.id === input.id && file.tenantId === input.tenantId,
      );

      if (index < 0) {
        return null;
      }

      const [record] = files.splice(index, 1);

      if (!record) {
        return null;
      }

      if (input.avatarUrlToClear) {
        for (const user of users.values()) {
          if (user.avatarUrl === input.avatarUrlToClear) {
            user.avatarUrl = null;
          }
        }
      }

      if (input.logoUrlToClear) {
        const tenant = tenants.get(input.tenantId);

        if (tenant?.logoUrl === input.logoUrlToClear) {
          tenant.logoUrl = null;
        }
      }

      logs.push({ ...input.log, entityId: record.id });
      return record;
    },
    async readUserAvatarUrl(userId) {
      return users.get(userId)?.avatarUrl ?? null;
    },
    async readTenantLogoUrl(tenantId) {
      return tenants.get(tenantId)?.logoUrl ?? null;
    },
    async listStoredFiles(input) {
      return files.filter((file) => {
        if (file.purpose !== input.purpose) {
          return false;
        }

        if (input.tenantId && file.tenantId !== input.tenantId) {
          return false;
        }

        return (
          !input.uploadedByUserId ||
          file.uploadedByUserId === input.uploadedByUserId
        );
      });
    },
    async clearUserAvatarUrl(userId) {
      const user = users.get(userId);

      if (user) {
        user.avatarUrl = null;
      }
    },
    async clearTenantLogoUrl(tenantId) {
      const tenant = tenants.get(tenantId);

      if (tenant) {
        tenant.logoUrl = null;
      }
    },
    async writeActionLog(log, entityId) {
      logs.push({ ...log, entityId });
    },
  };

  return {
    db,
    files,
    users,
    tenants,
    logs,
    failNextSave() {
      failSave = true;
    },
  };
}

function createFakeStorage() {
  const objects = new Map<string, Uint8Array>();
  const deleted: Array<{ bucket: string; objectKey: string }> = [];
  const storage: FileStorage = {
    async putObject(input) {
      objects.set(`${input.bucket}/${input.objectKey}`, input.bytes);
    },
    async deleteObject(input) {
      deleted.push(input);
      objects.delete(`${input.bucket}/${input.objectKey}`);
    },
    publicUrl(objectKey) {
      return `${publicBase}/${objectKey}`;
    },
    async privateUrl(input) {
      return `http://127.0.0.1:9000/${input.bucket}/${input.objectKey}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=300&X-Amz-Signature=fake`;
    },
    async ensureBuckets() {
      return undefined;
    },
  };

  return { storage, objects, deleted };
}

function setup() {
  const memory = createMemoryDb();
  const storage = createFakeStorage();
  const deps: FilesDeps = {
    db: memory.db,
    storage: storage.storage,
    publicBucket: 'myrophone-public',
    privateBucket: 'myrophone-private',
  };

  return {
    memory,
    storage,
    service: createFilesService(deps),
  };
}

function png(name = 'foto.png'): {
  originalName: string;
  contentType: string;
  bytes: Uint8Array;
} {
  return {
    originalName: name,
    contentType: 'image/png',
    bytes: new Uint8Array([1, 2, 3, 4]),
  };
}

describe('stored file service', () => {
  it('rejects a content type that does not match the purpose before storing the object', async () => {
    const { service, storage } = setup();

    await expect(
      service.upload({
        tenantId: 'tenant-1',
        userId: 'user-1',
        purpose: 'AVATAR',
        originalName: 'contrato-secreto.pdf',
        contentType: 'application/pdf',
        bytes: new Uint8Array([1]),
      }),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: 'INVALID_CONTENT_TYPE',
    });
    expect(storage.objects.size).toBe(0);
  });

  it('stores a public file under a server key and returns a stable public URL', async () => {
    const { service, memory } = setup();
    const uploaded = await service.upload({
      tenantId: 'tenant-1',
      userId: 'user-1',
      purpose: 'PUBLIC_IMAGE',
      ...png('contrato-secreto.pdf'),
      contentType: 'image/png',
    });
    const row = memory.files[0];

    expect(row?.objectKey).toContain('tenant-1/');
    expect(row?.objectKey).not.toContain('contrato-secreto');
    expect(row?.originalName).toBe('contrato-secreto.pdf');
    expect(uploaded.url).toContain(publicBase);
    expect(uploaded.url).toBe(`${publicBase}/${row?.objectKey}`);
    expect(uploaded.visibility).toBe('PUBLIC');

    const again = await service.get({
      id: uploaded.id,
      tenantId: 'tenant-1',
    });
    expect(again.url).toBe(uploaded.url);
    expect(memory.logs[0]).toMatchObject({
      action: 'files.upload',
      entityType: 'StoredFile',
      metadata: { purpose: 'PUBLIC_IMAGE', visibility: 'PUBLIC' },
    });
  });

  it('returns a presigned private URL and does not store it on the file', async () => {
    const { service, memory } = setup();
    const uploaded = await service.upload({
      tenantId: 'tenant-1',
      userId: 'user-1',
      purpose: 'DOCUMENT',
      originalName: 'contrato-secreto.pdf',
      contentType: 'application/pdf',
      bytes: new Uint8Array([9, 9]),
    });
    const row = memory.files[0];
    const publicUrl = `${publicBase}/${row?.objectKey}`;

    expect(uploaded.url).not.toBe(publicUrl);
    expect(uploaded.url).toContain('X-Amz-Signature=fake');
    expect(uploaded.url).toContain('X-Amz-Expires=300');
    expect(row).not.toHaveProperty('url');
    expect(JSON.stringify(row)).not.toContain('X-Amz-Signature');
    expect(JSON.stringify(memory.logs)).not.toContain('X-Amz-Signature');
    expect(memory.users.get('user-1')?.avatarUrl).toBeUndefined();
  });

  it('hides a file that belongs to another company', async () => {
    const { service, memory, storage } = setup();
    const uploaded = await service.upload({
      tenantId: 'tenant-1',
      userId: 'user-1',
      purpose: 'DOCUMENT',
      originalName: 'contrato-secreto.pdf',
      contentType: 'application/pdf',
      bytes: new Uint8Array([1]),
    });

    await expect(
      service.get({ id: uploaded.id, tenantId: 'tenant-2' }),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'FILE_NOT_FOUND',
    });
    await expect(
      service.delete({
        id: uploaded.id,
        tenantId: 'tenant-2',
        userId: 'user-2',
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'FILE_NOT_FOUND',
    });

    expect(storage.deleted).toHaveLength(0);
    expect(memory.files).toHaveLength(1);
    expect(memory.logs.map((log) => log.action)).toEqual(['files.upload']);
  });

  it('sets the user avatar from the public URL and clears it when that file is deleted', async () => {
    const { service, memory, storage } = setup();
    memory.users.set('user-1', { id: 'user-1', avatarUrl: null });
    memory.users.set('user-2', {
      id: 'user-2',
      avatarUrl: 'https://other.example/a.png',
    });

    const uploaded = await service.upload({
      tenantId: 'tenant-1',
      userId: 'user-1',
      purpose: 'AVATAR',
      ...png(),
    });

    expect(memory.users.get('user-1')?.avatarUrl).toBe(uploaded.url);
    expect(memory.tenants.get('tenant-1')?.logoUrl).toBeUndefined();
    expect(uploaded.url.startsWith(`${publicBase}/`)).toBe(true);

    const removed = await service.delete({
      id: uploaded.id,
      tenantId: 'tenant-1',
      userId: 'user-1',
    });

    expect(removed).toEqual({ id: uploaded.id, deleted: true });
    expect(memory.users.get('user-1')?.avatarUrl).toBeNull();
    expect(memory.users.get('user-2')?.avatarUrl).toBe(
      'https://other.example/a.png',
    );
    expect(storage.objects.size).toBe(0);
    expect(memory.logs.at(-1)).toMatchObject({
      action: 'files.delete',
      entityType: 'StoredFile',
      metadata: { purpose: 'AVATAR', visibility: 'PUBLIC' },
    });
  });

  it('does not clear an avatar URL that points at a different file', async () => {
    const { service, memory } = setup();
    memory.users.set('user-1', {
      id: 'user-1',
      avatarUrl: 'https://cdn.example/already.png',
    });

    const uploaded = await service.upload({
      tenantId: 'tenant-1',
      userId: 'user-1',
      purpose: 'AVATAR',
      ...png(),
    });
    memory.users.set('user-1', {
      id: 'user-1',
      avatarUrl: 'https://cdn.example/already.png',
    });

    await service.delete({
      id: uploaded.id,
      tenantId: 'tenant-1',
      userId: 'user-1',
    });

    expect(memory.users.get('user-1')?.avatarUrl).toBe(
      'https://cdn.example/already.png',
    );
  });

  it('deletes the stored object when the database insert fails', async () => {
    const { service, memory, storage } = setup();
    memory.failNextSave();

    await expect(
      service.upload({
        tenantId: 'tenant-1',
        userId: 'user-1',
        purpose: 'PUBLIC_IMAGE',
        ...png(),
      }),
    ).rejects.toThrow('insert failed');

    expect(storage.deleted).toHaveLength(1);
    expect(storage.deleted[0]?.bucket).toBe('myrophone-public');
    expect(storage.deleted[0]?.objectKey).toContain('tenant-1/');
    expect(storage.objects.size).toBe(0);
    expect(memory.files).toHaveLength(0);
    expect(memory.users.get('user-1')?.avatarUrl).toBeUndefined();
  });

  it('sets the company logo for a LOGO upload and does not change the avatar', async () => {
    const { service, memory } = setup();
    memory.users.set('user-1', {
      id: 'user-1',
      avatarUrl: 'https://cdn.example/avatar.png',
    });

    const uploaded = await service.upload({
      tenantId: 'tenant-1',
      userId: 'user-1',
      purpose: 'LOGO',
      ...png('logo.png'),
    });

    expect(memory.tenants.get('tenant-1')?.logoUrl).toBe(uploaded.url);
    expect(memory.users.get('user-1')?.avatarUrl).toBe(
      'https://cdn.example/avatar.png',
    );
    expect(memory.logs[0]).toMatchObject({
      action: 'files.upload',
      metadata: { purpose: 'LOGO', visibility: 'PUBLIC' },
    });

    await service.delete({
      id: uploaded.id,
      tenantId: 'tenant-1',
      userId: 'user-1',
    });

    expect(memory.tenants.get('tenant-1')?.logoUrl).toBeNull();
    expect(memory.users.get('user-1')?.avatarUrl).toBe(
      'https://cdn.example/avatar.png',
    );
    expect(JSON.stringify(memory.logs)).not.toContain('X-Amz-');
  });

  it('returns 503 when object storage is unavailable', async () => {
    const { service, storage } = setup();
    storage.storage.putObject = () =>
      Promise.reject(new Error('connect ECONNREFUSED'));

    await expect(
      service.upload({
        tenantId: 'tenant-1',
        userId: 'user-1',
        purpose: 'PUBLIC_IMAGE',
        ...png(),
      }),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'STORAGE_UNAVAILABLE',
    });
  });
});
