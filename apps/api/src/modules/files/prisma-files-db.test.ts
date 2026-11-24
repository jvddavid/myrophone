import { describe, expect, it } from 'vitest';
import type { PrismaDb } from '../auth/db-types';
import { createPrismaFilesDb } from './prisma-files-db';
import type {
  FileActionLogInput,
  NewStoredFile,
  StoredFileRecord,
} from './types';

function fileData(overrides: Partial<NewStoredFile> = {}): NewStoredFile {
  return {
    tenantId: 'tenant-1',
    uploadedByUserId: 'user-1',
    visibility: 'PUBLIC',
    purpose: 'AVATAR',
    bucket: 'myrophone-public',
    objectKey: 'tenant-1/6f1c5c3e-6b1a-4d0e-9a4a-3d6e2a1b9c70',
    originalName: 'foto.png',
    contentType: 'image/png',
    sizeBytes: 4,
    ...overrides,
  };
}

function log(action: FileActionLogInput['action']): FileActionLogInput {
  return {
    tenantId: 'tenant-1',
    actorUserId: 'user-1',
    action,
    entityType: 'StoredFile',
    metadata: { purpose: 'AVATAR', visibility: 'PUBLIC' },
    ipAddress: null,
    userAgent: null,
  };
}

interface FakePrisma {
  storedFile: {
    create(args: { data: NewStoredFile }): Promise<StoredFileRecord>;
    findFirst(args: {
      where: { id?: string; tenantId?: string };
    }): Promise<StoredFileRecord | null>;
    deleteMany(args: {
      where: { id?: string; tenantId?: string };
    }): Promise<{ count: number }>;
  };
  user: {
    update(args: {
      where: { id: string };
      data: { avatarUrl: string | null };
    }): Promise<{ id: string; avatarUrl: string | null }>;
    findMany(args: {
      where: { avatarUrl: string };
    }): Promise<Array<{ id: string }>>;
  };
  actionLog: {
    create(args: {
      data: Record<string, unknown>;
    }): Promise<Record<string, unknown>>;
  };
  tenant: {
    update(args: {
      where: { id: string };
      data: { logoUrl: string | null };
    }): Promise<{ id: string; logoUrl: string | null }>;
    findUnique(args: {
      where: { id: string };
    }): Promise<{ id: string; logoUrl: string | null } | null>;
  };
  $transaction<T>(fn: (tx: FakePrisma) => Promise<T>): Promise<T>;
}

function createFakePrisma() {
  const files: StoredFileRecord[] = [];
  const users: Array<{ id: string; avatarUrl: string | null }> = [];
  const tenants = new Map<string, { id: string; logoUrl: string | null }>();
  const logs: Array<Record<string, unknown>> = [];

  const db: FakePrisma = {
    storedFile: {
      async create({ data }: { data: NewStoredFile }) {
        const row: StoredFileRecord = {
          ...data,
          id: `file-${files.length + 1}`,
          createdAt: new Date('2026-11-23T18:00:00.000Z'),
        };
        files.push(row);
        return row;
      },
      async findFirst({
        where,
      }: {
        where: { id?: string; tenantId?: string };
      }) {
        return (
          files.find(
            (file) => file.id === where.id && file.tenantId === where.tenantId,
          ) ?? null
        );
      },
      async deleteMany({
        where,
      }: {
        where: { id?: string; tenantId?: string };
      }) {
        const before = files.length;

        for (let index = files.length - 1; index >= 0; index -= 1) {
          const file = files[index];
          if (file?.id === where.id && file.tenantId === where.tenantId) {
            files.splice(index, 1);
          }
        }

        return { count: before - files.length };
      },
    },
    user: {
      async update({
        where,
        data,
      }: {
        where: { id: string };
        data: { avatarUrl: string | null };
      }) {
        const user = users.find((candidate) => candidate.id === where.id);

        if (!user) {
          throw new Error('user missing');
        }

        user.avatarUrl = data.avatarUrl;
        return user;
      },
      async findMany({ where }: { where: { avatarUrl: string } }) {
        return users
          .filter((user) => user.avatarUrl === where.avatarUrl)
          .map((user) => ({ id: user.id }));
      },
    },
    actionLog: {
      async create({ data }: { data: Record<string, unknown> }) {
        logs.push(data);
        return data;
      },
    },
    tenant: {
      async update({
        where,
        data,
      }: {
        where: { id: string };
        data: { logoUrl: string | null };
      }) {
        const tenant = tenants.get(where.id) ?? {
          id: where.id,
          logoUrl: null,
        };
        tenant.logoUrl = data.logoUrl;
        tenants.set(tenant.id, tenant);
        return tenant;
      },
      async findUnique({ where }: { where: { id: string } }) {
        return tenants.get(where.id) ?? null;
      },
    },
    async $transaction(fn) {
      return fn(db);
    },
  };

  return {
    db: db as unknown as PrismaDb,
    files,
    users,
    tenants,
    logs,
  };
}

describe('prisma stored file adapter', () => {
  it('writes the avatar URL and an action log without a signed URL', async () => {
    const fake = createFakePrisma();
    fake.users.push({ id: 'user-1', avatarUrl: null });
    const files = createPrismaFilesDb(fake.db);
    const publicUrl =
      'http://127.0.0.1:9000/myrophone-public/tenant-1/6f1c5c3e-6b1a-4d0e-9a4a-3d6e2a1b9c70';

    const saved = await files.saveUploadedFile({
      file: fileData(),
      avatarUrl: publicUrl,
      avatarUserId: 'user-1',
      logoUrl: null,
      logoTenantId: null,
      log: log('files.upload'),
    });

    expect(saved.tenantId).toBe('tenant-1');
    expect(fake.users[0]?.avatarUrl).toBe(publicUrl);
    expect(fake.logs[0]).toMatchObject({
      action: 'files.upload',
      entityType: 'StoredFile',
      entityId: saved.id,
      metadata: { purpose: 'AVATAR', visibility: 'PUBLIC' },
    });
    expect(JSON.stringify(fake.logs)).not.toContain('X-Amz-');
    expect(JSON.stringify(fake.files[0])).not.toContain(publicUrl);
  });

  it('does not read or delete a file from another company', async () => {
    const fake = createFakePrisma();
    const files = createPrismaFilesDb(fake.db);
    const saved = await files.saveUploadedFile({
      file: fileData({ purpose: 'DOCUMENT', visibility: 'PRIVATE' }),
      avatarUrl: null,
      avatarUserId: null,
      logoUrl: null,
      logoTenantId: null,
      log: log('files.upload'),
    });

    expect(await files.findInTenant(saved.id, 'tenant-2')).toBeNull();
    expect(
      await files.deleteUploadedFile({
        id: saved.id,
        tenantId: 'tenant-2',
        avatarUrlToClear: null,
        logoUrlToClear: null,
        log: log('files.delete'),
      }),
    ).toBeNull();
    expect(fake.files).toHaveLength(1);
  });

  it('clears only the avatar URL that matches the deleted file', async () => {
    const fake = createFakePrisma();
    const publicUrl =
      'http://127.0.0.1:9000/myrophone-public/tenant-1/6f1c5c3e-6b1a-4d0e-9a4a-3d6e2a1b9c70';
    fake.users.push(
      { id: 'user-1', avatarUrl: publicUrl },
      { id: 'user-2', avatarUrl: 'https://other.example/a.png' },
    );
    const files = createPrismaFilesDb(fake.db);
    const saved = await files.saveUploadedFile({
      file: fileData(),
      avatarUrl: publicUrl,
      avatarUserId: 'user-1',
      logoUrl: null,
      logoTenantId: null,
      log: log('files.upload'),
    });

    await files.deleteUploadedFile({
      id: saved.id,
      tenantId: 'tenant-1',
      avatarUrlToClear: publicUrl,
      logoUrlToClear: null,
      log: log('files.delete'),
    });

    expect(fake.files).toHaveLength(0);
    expect(fake.users[0]?.avatarUrl).toBeNull();
    expect(fake.users[1]?.avatarUrl).toBe('https://other.example/a.png');
  });

  it('writes the logo URL without changing the user avatar', async () => {
    const fake = createFakePrisma();
    fake.users.push({
      id: 'user-1',
      avatarUrl: 'https://cdn.example/avatar.png',
    });
    const files = createPrismaFilesDb(fake.db);
    const publicUrl =
      'http://127.0.0.1:9000/myrophone-public/tenant-1/6f1c5c3e-6b1a-4d0e-9a4a-3d6e2a1b9c70';

    await files.saveUploadedFile({
      file: fileData({ purpose: 'LOGO' }),
      avatarUrl: null,
      avatarUserId: null,
      logoUrl: publicUrl,
      logoTenantId: 'tenant-1',
      log: log('files.upload'),
    });

    expect(fake.tenants.get('tenant-1')?.logoUrl).toBe(publicUrl);
    expect(fake.users[0]?.avatarUrl).toBe('https://cdn.example/avatar.png');

    const saved = fake.files[0];
    await files.deleteUploadedFile({
      id: saved?.id ?? '',
      tenantId: 'tenant-1',
      avatarUrlToClear: null,
      logoUrlToClear: publicUrl,
      log: log('files.delete'),
    });

    expect(fake.tenants.get('tenant-1')?.logoUrl).toBeNull();
    expect(fake.users[0]?.avatarUrl).toBe('https://cdn.example/avatar.png');
  });
});
