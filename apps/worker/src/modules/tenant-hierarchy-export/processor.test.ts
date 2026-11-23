import type {
  HierarchyExportProgress,
  TenantHierarchyExportJobData,
} from '@myrophone/shared';
import { describe, expect, it } from 'vitest';
import { processTenantHierarchyExportJob } from './processor';

function createPayload(): TenantHierarchyExportJobData {
  return {
    requestId: 'job-1',
    tenantId: 'tenant-1',
    tenantSlug: 'tenant-1',
    tenantName: 'Tenant 1',
    requestedByUserId: 'user-1',
    requestedAt: new Date().toISOString(),
    snapshot: {
      tenantId: 'tenant-1',
      tenantSlug: 'tenant-1',
      tenantName: 'Tenant 1',
      generatedAt: new Date().toISOString(),
      teams: [
        {
          id: 'team-1',
          slug: 'vendas',
          name: 'Vendas',
          memberCount: 1,
        },
      ],
      users: [
        {
          userId: 'user-1',
          email: 'owner@tenant.com',
          name: 'Owner',
          tenantRole: 'OWNER',
          avatarUrl: 'https://example.com/avatar.svg',
          teamRoles: [
            {
              teamId: 'team-1',
              role: 'LEADER',
            },
          ],
        },
      ],
      edges: [
        {
          from: 'tenant:tenant-1',
          to: 'user:user-1',
          relation: 'tenant_role',
          label: 'OWNER',
        },
      ],
    },
  };
}

describe('processTenantHierarchyExportJob', () => {
  it('generates a PDF result and reports progress', async () => {
    const steps: HierarchyExportProgress[] = [];

    const result = await processTenantHierarchyExportJob(createPayload(), {
      timeoutMs: 2_000,
      onProgress: async (progress) => {
        steps.push(progress);
      },
    });

    expect(result.format).toBe('pdf');
    expect(result.mimeType).toBe('application/pdf');
    expect(result.contentBase64.length).toBeGreaterThan(0);
    expect(result.sizeBytes).toBeGreaterThan(0);

    expect(steps.length).toBeGreaterThan(0);
    expect(steps.at(-1)?.status).toBe('completed');
    expect(steps.at(-1)?.percent).toBe(100);
  });

  it('fails when timeout is too short', async () => {
    await expect(
      processTenantHierarchyExportJob(createPayload(), {
        timeoutMs: 1,
        artificialDelayMs: 10,
      }),
    ).rejects.toThrow();
  });
});
