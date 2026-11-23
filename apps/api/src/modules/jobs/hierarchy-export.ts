import {
  getJobDefinition,
  type HierarchyExportProgress,
  normalizeQueueJobState,
  type QueueJobState,
  type TenantHierarchyEdge,
  type TenantHierarchyExportJobData,
  type TenantHierarchyExportResult,
  type TenantHierarchySnapshot,
} from '@myrophone/shared';
import { getPrisma } from '../../core/db/prisma';
import { AppError } from '../../core/errors/app-error';
import { asType } from '../auth/db-types';
import { defaultJobRetention, getQueue } from './core';

const hierarchyExportJob = getJobDefinition('tenantHierarchyExport');

function getHierarchyExportQueue() {
  return getQueue<TenantHierarchyExportJobData, TenantHierarchyExportResult>(
    hierarchyExportJob.queueName,
  );
}

interface TenantHierarchyMembershipRecord {
  userId: string;
  role: {
    name: 'OWNER' | 'ADMIN' | 'USER';
  };
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  teams: Array<{
    role: 'LEADER' | 'MEMBER';
    team: {
      id: string;
      slug: string;
      name: string;
    };
  }>;
}

function getAvatarUrl(name: string | null, email: string): string {
  const seed = encodeURIComponent(name?.trim() || email);
  return `https://api.dicebear.com/9.x/initials/svg?seed=${seed}`;
}

function toSnapshot(
  tenantId: string,
  tenantSlug: string,
  tenantName: string,
  memberships: TenantHierarchyMembershipRecord[],
): TenantHierarchySnapshot {
  const teamsById = new Map<
    string,
    {
      id: string;
      slug: string;
      name: string;
      memberIds: Set<string>;
    }
  >();

  for (const membership of memberships) {
    for (const teamMembership of membership.teams) {
      const current = teamsById.get(teamMembership.team.id);
      if (current) {
        current.memberIds.add(membership.user.id);
        continue;
      }

      teamsById.set(teamMembership.team.id, {
        id: teamMembership.team.id,
        slug: teamMembership.team.slug,
        name: teamMembership.team.name,
        memberIds: new Set([membership.user.id]),
      });
    }
  }

  const users = memberships.map((membership) => ({
    userId: membership.user.id,
    email: membership.user.email,
    name: membership.user.name,
    tenantRole: membership.role.name,
    avatarUrl: getAvatarUrl(membership.user.name, membership.user.email),
    teamRoles: membership.teams.map((teamMembership) => ({
      teamId: teamMembership.team.id,
      role: teamMembership.role,
    })),
  }));

  const teams = Array.from(teamsById.values())
    .map((team) => ({
      id: team.id,
      slug: team.slug,
      name: team.name,
      memberCount: team.memberIds.size,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  const edges: TenantHierarchyEdge[] = memberships.flatMap((membership) => {
    const tenantRoleEdge: TenantHierarchyEdge = {
      from: `tenant:${tenantId}`,
      to: `user:${membership.user.id}`,
      relation: 'tenant_role',
      label: membership.role.name,
    };

    const teamEdges = membership.teams.map<TenantHierarchyEdge>(
      (teamMembership) => ({
        from: `team:${teamMembership.team.id}`,
        to: `user:${membership.user.id}`,
        relation: 'team_member',
        label: teamMembership.role,
      }),
    );

    return [tenantRoleEdge, ...teamEdges];
  });

  return {
    tenantId,
    tenantSlug,
    tenantName,
    users,
    teams,
    edges,
    generatedAt: new Date().toISOString(),
  };
}

function isHierarchyExportProgress(
  value: unknown,
): value is HierarchyExportProgress {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as {
    status?: unknown;
    step?: unknown;
    completedSteps?: unknown;
    percent?: unknown;
    message?: unknown;
    startedAt?: unknown;
    updatedAt?: unknown;
  };

  return (
    typeof candidate.status === 'string' &&
    typeof candidate.step === 'string' &&
    Array.isArray(candidate.completedSteps) &&
    typeof candidate.percent === 'number' &&
    typeof candidate.message === 'string' &&
    typeof candidate.startedAt === 'string' &&
    typeof candidate.updatedAt === 'string'
  );
}

function isHierarchyExportResult(
  value: unknown,
): value is TenantHierarchyExportResult {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as {
    format?: unknown;
    fileName?: unknown;
    mimeType?: unknown;
    contentBase64?: unknown;
    sizeBytes?: unknown;
    generatedAt?: unknown;
    tenantId?: unknown;
    steps?: unknown;
  };

  return (
    candidate.format === 'pdf' &&
    typeof candidate.fileName === 'string' &&
    candidate.mimeType === 'application/pdf' &&
    typeof candidate.contentBase64 === 'string' &&
    typeof candidate.sizeBytes === 'number' &&
    typeof candidate.generatedAt === 'string' &&
    typeof candidate.tenantId === 'string' &&
    Array.isArray(candidate.steps)
  );
}

function toIsoDateOrNull(value: number | undefined): string | null {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }

  return new Date(value).toISOString();
}

export async function enqueueTenantHierarchyExportJob(input: {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  requestedByUserId: string;
}): Promise<{ jobId: string }> {
  const prisma = await getPrisma();

  const memberships = asType<TenantHierarchyMembershipRecord[]>(
    await prisma.membership.findMany({
      where: {
        tenantId: input.tenantId,
        status: 'ACTIVE',
      },
      include: {
        role: {
          select: {
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        teams: {
          include: {
            team: {
              select: {
                id: true,
                slug: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    }),
  );

  const requestId = crypto.randomUUID();

  const payload: TenantHierarchyExportJobData = {
    requestId,
    tenantId: input.tenantId,
    tenantSlug: input.tenantSlug,
    tenantName: input.tenantName,
    requestedByUserId: input.requestedByUserId,
    requestedAt: new Date().toISOString(),
    snapshot: toSnapshot(
      input.tenantId,
      input.tenantSlug,
      input.tenantName,
      memberships,
    ),
  };

  const job = await getHierarchyExportQueue().add(
    hierarchyExportJob.jobName,
    payload,
    {
      jobId: requestId,
      attempts: hierarchyExportJob.defaults.attempts,
      backoff: {
        type: 'exponential',
        delay: hierarchyExportJob.defaults.backoffDelayMs,
      },
      removeOnComplete: {
        age: defaultJobRetention.completeAgeSeconds,
        count: defaultJobRetention.completeCount,
      },
      removeOnFail: {
        age: defaultJobRetention.failAgeSeconds,
        count: defaultJobRetention.failCount,
      },
    },
  );

  const jobId = job.id ?? requestId;

  await prisma.actionLog.create({
    data: {
      tenantId: input.tenantId,
      actorUserId: input.requestedByUserId,
      action: 'tenant.hierarchy_export.requested',
      entityType: 'job',
      entityId: jobId,
      metadata: {
        queue: hierarchyExportJob.queueName,
      },
    },
  });

  return {
    jobId,
  };
}

export async function getTenantHierarchyExportJobStatus(input: {
  tenantId: string;
  jobId: string;
}): Promise<{
  jobId: string;
  queue: string;
  state: QueueJobState;
  progress: HierarchyExportProgress | null;
  result: Omit<TenantHierarchyExportResult, 'contentBase64'> | null;
  failedReason: string | null;
  createdAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}> {
  const job = await getHierarchyExportQueue().getJob(input.jobId);

  if (!job || job.data.tenantId !== input.tenantId) {
    throw new AppError({
      statusCode: 404,
      code: 'JOB_NOT_FOUND',
      message: 'Job not found for this tenant.',
    });
  }

  const state = normalizeQueueJobState(await job.getState());

  const progress = isHierarchyExportProgress(job.progress)
    ? job.progress
    : null;

  const result = isHierarchyExportResult(job.returnvalue)
    ? {
        format: job.returnvalue.format,
        fileName: job.returnvalue.fileName,
        mimeType: job.returnvalue.mimeType,
        sizeBytes: job.returnvalue.sizeBytes,
        generatedAt: job.returnvalue.generatedAt,
        tenantId: job.returnvalue.tenantId,
        steps: job.returnvalue.steps,
      }
    : null;

  return {
    jobId: job.id ?? input.jobId,
    queue: hierarchyExportJob.queueName,
    state,
    progress,
    result,
    failedReason: job.failedReason ?? null,
    createdAt: toIsoDateOrNull(job.timestamp),
    startedAt: toIsoDateOrNull(job.processedOn),
    finishedAt: toIsoDateOrNull(job.finishedOn),
  };
}

export async function getTenantHierarchyExportFile(input: {
  tenantId: string;
  jobId: string;
}): Promise<{
  fileName: string;
  mimeType: 'application/pdf';
  bytes: Uint8Array;
}> {
  const job = await getHierarchyExportQueue().getJob(input.jobId);

  if (!job || job.data.tenantId !== input.tenantId) {
    throw new AppError({
      statusCode: 404,
      code: 'JOB_NOT_FOUND',
      message: 'Job not found for this tenant.',
    });
  }

  const state = normalizeQueueJobState(await job.getState());

  if (state !== 'completed' || !isHierarchyExportResult(job.returnvalue)) {
    throw new AppError({
      statusCode: 409,
      code: 'JOB_NOT_COMPLETED',
      message: 'Export file is not available yet.',
      details: {
        state,
      },
    });
  }

  return {
    fileName: job.returnvalue.fileName,
    mimeType: 'application/pdf',
    bytes: Buffer.from(job.returnvalue.contentBase64, 'base64'),
  };
}
