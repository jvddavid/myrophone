import { Elysia, t } from 'elysia';
import { AppError } from '../../../core/errors/app-error';
import { logger } from '../../../core/logger';
import { getRequestMeta } from '../request-meta';
import {
  addTeamMember,
  createTenantTeam,
  createTenantUser,
  ensurePermission,
  listTenantActionLogs,
  listTenantTeams,
  listTenantUsers,
  removeTeamMember,
  requireAuthContext,
  requireTenantContext,
  updateTeamPermissions,
} from '../service';

const teamPermissionKeySchema = t.Union([
  t.Literal('dashboard.view'),
  t.Literal('management.view'),
  t.Literal('deliveries.view'),
  t.Literal('sales.view'),
  t.Literal('support.view'),
  t.Literal('reports.view'),
]);

const createUserBodySchema = t.Object({
  name: t.String({ minLength: 2 }),
  email: t.String({ format: 'email' }),
  password: t.String({ minLength: 8 }),
  roleName: t.Optional(
    t.Union([t.Literal('OWNER'), t.Literal('ADMIN'), t.Literal('USER')]),
  ),
  teamIds: t.Optional(t.Array(t.String({ minLength: 1 }), { minItems: 1 })),
  teamMembershipRole: t.Optional(
    t.Union([t.Literal('LEADER'), t.Literal('MEMBER')]),
  ),
});

const createTeamBodySchema = t.Object({
  name: t.String({ minLength: 2 }),
  slug: t.Optional(t.String({ minLength: 2 })),
  description: t.Optional(t.String({ minLength: 2 })),
  permissionKeys: t.Optional(t.Array(teamPermissionKeySchema)),
  leaderUserIds: t.Optional(
    t.Array(t.String({ minLength: 1 }), { minItems: 1 }),
  ),
});

const updateTeamPermissionsParamsSchema = t.Object({
  teamId: t.String({ minLength: 1 }),
});

const updateTeamPermissionsBodySchema = t.Object({
  permissionKeys: t.Array(teamPermissionKeySchema),
});

const teamMemberParamsSchema = t.Object({
  teamId: t.String({ minLength: 1 }),
});

const teamMemberBodySchema = t.Object({
  userId: t.String({ minLength: 1 }),
  role: t.Optional(t.Union([t.Literal('LEADER'), t.Literal('MEMBER')])),
});

const removeTeamMemberParamsSchema = t.Object({
  teamId: t.String({ minLength: 1 }),
  userId: t.String({ minLength: 1 }),
});

const logsQuerySchema = t.Object({
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 200 })),
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

  logger.error({ err: error }, 'Unexpected error in management routes');
  return status(500, {
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error happened.',
  });
}

export const managementRoutes = new Elysia()
  .get('/tenants/current', async ({ request, status }) => {
    try {
      const auth = requireTenantContext(await requireAuthContext(request));
      ensurePermission(auth, 'tenant.read');

      return {
        tenant: auth.tenant,
        role: auth.role,
        teams: auth.teams,
      };
    } catch (error) {
      return toErrorResponse(error, status);
    }
  })
  .get('/permissions/me', async ({ request, status }) => {
    try {
      const auth = await requireAuthContext(request);

      return {
        role: auth.role,
        permissions: auth.permissions,
        teams: auth.teams,
        teamPermissions: auth.teamPermissions,
      };
    } catch (error) {
      return toErrorResponse(error, status);
    }
  })
  .get('/teams', async ({ request, status }) => {
    try {
      const auth = requireTenantContext(await requireAuthContext(request));
      ensurePermission(auth, 'teams.read');

      return {
        items: await listTenantTeams(auth.tenant.id),
      };
    } catch (error) {
      return toErrorResponse(error, status);
    }
  })
  .post(
    '/teams',
    async ({ body, request, status }) => {
      try {
        const auth = requireTenantContext(await requireAuthContext(request));
        ensurePermission(auth, 'teams.manage');

        const team = await createTenantTeam(
          {
            tenantId: auth.tenant.id,
            actorUserId: auth.user.id,
            name: body.name,
            slug: body.slug,
            description: body.description,
            permissionKeys: body.permissionKeys,
            leaderUserIds: body.leaderUserIds,
          },
          getRequestMeta(request),
        );

        return status(201, team);
      } catch (error) {
        return toErrorResponse(error, status);
      }
    },
    {
      body: createTeamBodySchema,
    },
  )
  .put(
    '/teams/:teamId/permissions',
    async ({ params, body, request, status }) => {
      try {
        const auth = requireTenantContext(await requireAuthContext(request));
        ensurePermission(auth, 'teams.manage');

        return await updateTeamPermissions(
          {
            tenantId: auth.tenant.id,
            actorUserId: auth.user.id,
            teamId: params.teamId,
            permissionKeys: body.permissionKeys,
          },
          getRequestMeta(request),
        );
      } catch (error) {
        return toErrorResponse(error, status);
      }
    },
    {
      params: updateTeamPermissionsParamsSchema,
      body: updateTeamPermissionsBodySchema,
    },
  )
  .post(
    '/teams/:teamId/members',
    async ({ params, body, request, status }) => {
      try {
        const auth = requireTenantContext(await requireAuthContext(request));
        ensurePermission(auth, 'teams.members.manage');

        return await addTeamMember(
          {
            authContext: auth,
            teamId: params.teamId,
            targetUserId: body.userId,
            membershipRole: body.role,
          },
          getRequestMeta(request),
        );
      } catch (error) {
        return toErrorResponse(error, status);
      }
    },
    {
      params: teamMemberParamsSchema,
      body: teamMemberBodySchema,
    },
  )
  .delete(
    '/teams/:teamId/members/:userId',
    async ({ params, request, status }) => {
      try {
        const auth = requireTenantContext(await requireAuthContext(request));
        ensurePermission(auth, 'teams.members.manage');

        return await removeTeamMember(
          {
            authContext: auth,
            teamId: params.teamId,
            targetUserId: params.userId,
          },
          getRequestMeta(request),
        );
      } catch (error) {
        return toErrorResponse(error, status);
      }
    },
    {
      params: removeTeamMemberParamsSchema,
    },
  )
  .get('/users', async ({ request, status }) => {
    try {
      const auth = requireTenantContext(await requireAuthContext(request));
      ensurePermission(auth, 'users.read');

      return {
        items: await listTenantUsers(auth.tenant.id),
      };
    } catch (error) {
      return toErrorResponse(error, status);
    }
  })
  .post(
    '/users',
    async ({ body, request, status }) => {
      try {
        const auth = requireTenantContext(await requireAuthContext(request));
        ensurePermission(auth, 'users.manage');

        const user = await createTenantUser(
          {
            tenantId: auth.tenant.id,
            actorUserId: auth.user.id,
            roleName: body.roleName,
            email: body.email,
            name: body.name,
            password: body.password,
            teamIds: body.teamIds,
            teamMembershipRole: body.teamMembershipRole,
          },
          getRequestMeta(request),
        );

        return status(201, user);
      } catch (error) {
        return toErrorResponse(error, status);
      }
    },
    {
      body: createUserBodySchema,
    },
  )
  .get(
    '/action-logs',
    async ({ query, request, status }) => {
      try {
        const auth = requireTenantContext(await requireAuthContext(request));
        ensurePermission(auth, 'logs.read');

        return {
          items: await listTenantActionLogs(auth.tenant.id, query.limit ?? 100),
        };
      } catch (error) {
        return toErrorResponse(error, status);
      }
    },
    {
      query: logsQuerySchema,
    },
  );
