import { Elysia, t } from 'elysia';
import { AppError } from '../../../core/errors/app-error';
import { logger } from '../../../core/logger';
import { getFilesService } from '../../files/runtime';
import {
  assignCompanyMemberTeam,
  createCompanyAccess,
  inviteCompanyMember,
  listCompanyMembers,
  listOwnedCompanies,
  listTeamCandidates,
  listTeamMembers,
  removeCompanyMember,
} from '../company-access';
import {
  readCompanyTemplates,
  readMemberPermissions,
  replaceCompanyTemplate,
  replaceMemberPermissions,
} from '../company-permission-store';
import { getRequestMeta } from '../request-meta';
import {
  addTeamMember,
  createOwnedCompany,
  createTenantTeam,
  createTenantUser,
  ensurePermission,
  listTenantActionLogs,
  listTenantTeams,
  listTenantUsers,
  readOwnedCompany,
  removeTeamMember,
  requireAuthContext,
  requireTenantContext,
  updateOwnedCompany,
  updateTeamPermissions,
  updateTenantTeam,
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

const departmentIconSchema = t.Optional(t.String({ maxLength: 64 }));

const createTeamBodySchema = t.Object({
  name: t.String({ minLength: 2 }),
  slug: t.Optional(t.String({ minLength: 2 })),
  description: t.Optional(t.String({ minLength: 2 })),
  icon: departmentIconSchema,
  permissionKeys: t.Optional(t.Array(teamPermissionKeySchema)),
  leaderUserIds: t.Optional(
    t.Array(t.String({ minLength: 1 }), { minItems: 1 }),
  ),
});

const updateTeamParamsSchema = t.Object({
  teamId: t.String({ minLength: 1 }),
});

const updateTeamBodySchema = t.Object({
  name: t.String({ minLength: 2, maxLength: 120 }),
  description: t.Optional(
    t.Union([t.String({ minLength: 2, maxLength: 280 }), t.Null()]),
  ),
  icon: departmentIconSchema,
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

const memberListQuerySchema = t.Object({
  q: t.Optional(t.String({ maxLength: 200 })),
  page: t.Optional(t.Numeric({ minimum: 1 })),
  pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
  unassigned: t.Optional(t.String({ maxLength: 8 })),
});

const inviteMemberBodySchema = t.Object({
  email: t.String({ format: 'email' }),
  role: t.Optional(t.Literal('USER')),
});

const createMemberBodySchema = t.Object({
  name: t.String({ minLength: 2 }),
  phone: t.String({ minLength: 8, maxLength: 20 }),
  email: t.String({ format: 'email' }),
  password: t.String({ minLength: 8 }),
  companies: t.Array(
    t.Object({
      tenantId: t.String({ minLength: 1 }),
      teamId: t.String({ minLength: 1 }),
    }),
    { minItems: 1 },
  ),
});

const memberParamsSchema = t.Object({
  userId: t.String({ minLength: 1 }),
});

const permissionKeysSchema = t.Array(t.String({ minLength: 1 }));

const permissionTemplateBodySchema = t.Object({
  role: t.Union([t.Literal('ADMIN'), t.Literal('USER')]),
  permissionKeys: permissionKeysSchema,
});

const memberPermissionBodySchema = t.Object({
  permissionKeys: permissionKeysSchema,
});

const assignTeamBodySchema = t.Object({
  teamId: t.String({ minLength: 1 }),
});

const companyParamsSchema = t.Object({
  tenantId: t.String({ minLength: 1 }),
});

const createOwnedCompanyBodySchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 120 }),
  description: t.Optional(t.String({ maxLength: 280 })),
});

const updateOwnedCompanyBodySchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 120 }),
  description: t.Optional(t.String({ maxLength: 280 })),
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
  .get('/companies/permission-templates', async ({ request, status }) => {
    try {
      const auth = requireTenantContext(await requireAuthContext(request));
      ensurePermission(auth, 'permissions.manage');

      return await readCompanyTemplates(auth.tenant.id);
    } catch (error) {
      return toErrorResponse(error, status);
    }
  })
  .put(
    '/companies/permission-templates',
    async ({ body, request, status }) => {
      try {
        const auth = requireTenantContext(await requireAuthContext(request));
        ensurePermission(auth, 'permissions.manage');

        return await replaceCompanyTemplate(
          {
            tenantId: auth.tenant.id,
            actorUserId: auth.user.id,
            role: body.role,
            permissionKeys: body.permissionKeys,
          },
          getRequestMeta(request),
        );
      } catch (error) {
        return toErrorResponse(error, status);
      }
    },
    { body: permissionTemplateBodySchema },
  )
  .get(
    '/companies/members/:userId/permissions',
    async ({ params, request, status }) => {
      try {
        const auth = requireTenantContext(await requireAuthContext(request));
        ensurePermission(auth, 'permissions.manage');

        return await readMemberPermissions(auth.tenant.id, params.userId);
      } catch (error) {
        return toErrorResponse(error, status);
      }
    },
    { params: memberParamsSchema },
  )
  .put(
    '/companies/members/:userId/permissions',
    async ({ params, body, request, status }) => {
      try {
        const auth = requireTenantContext(await requireAuthContext(request));
        ensurePermission(auth, 'permissions.manage');

        return await replaceMemberPermissions(
          {
            tenantId: auth.tenant.id,
            actorUserId: auth.user.id,
            targetUserId: params.userId,
            permissionKeys: body.permissionKeys,
          },
          getRequestMeta(request),
        );
      } catch (error) {
        return toErrorResponse(error, status);
      }
    },
    { params: memberParamsSchema, body: memberPermissionBodySchema },
  )
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
            icon: body.icon,
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
  .patch(
    '/teams/:teamId',
    async ({ params, body, request, status }) => {
      try {
        const auth = requireTenantContext(await requireAuthContext(request));
        ensurePermission(auth, 'teams.manage');

        return await updateTenantTeam(
          {
            tenantId: auth.tenant.id,
            actorUserId: auth.user.id,
            teamId: params.teamId,
            name: body.name,
            description: body.description,
            icon: body.icon,
          },
          getRequestMeta(request),
        );
      } catch (error) {
        return toErrorResponse(error, status);
      }
    },
    {
      params: updateTeamParamsSchema,
      body: updateTeamBodySchema,
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
  .get(
    '/teams/:teamId/members',
    async ({ params, query, request, status }) => {
      try {
        const auth = requireTenantContext(await requireAuthContext(request));
        ensurePermission(auth, 'teams.read');

        return await listTeamMembers(auth.tenant.id, params.teamId, {
          q: query.q,
          page: query.page,
          pageSize: query.pageSize,
        });
      } catch (error) {
        return toErrorResponse(error, status);
      }
    },
    {
      params: teamMemberParamsSchema,
      query: memberListQuerySchema,
    },
  )
  .get(
    '/teams/:teamId/candidates',
    async ({ params, query, request, status }) => {
      try {
        const auth = requireTenantContext(await requireAuthContext(request));
        ensurePermission(auth, 'teams.members.manage');

        return await listTeamCandidates(auth.tenant.id, params.teamId, {
          q: query.q,
          page: query.page,
          pageSize: query.pageSize,
        });
      } catch (error) {
        return toErrorResponse(error, status);
      }
    },
    {
      params: teamMemberParamsSchema,
      query: memberListQuerySchema,
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

        if (body.roleName === 'OWNER') {
          ensurePermission(auth, 'permissions.manage');
        }

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
  )
  .post(
    '/companies/members/invite',
    async ({ body, request, status }) => {
      try {
        const auth = requireTenantContext(await requireAuthContext(request));
        ensurePermission(auth, 'users.manage');
        const invited = await inviteCompanyMember(
          {
            tenantId: auth.tenant.id,
            actorUserId: auth.user.id,
            email: body.email,
          },
          getRequestMeta(request),
        );
        return status(201, invited);
      } catch (error) {
        return toErrorResponse(error, status);
      }
    },
    { body: inviteMemberBodySchema },
  )
  .post(
    '/companies/members',
    async ({ body, request, status }) => {
      try {
        const auth = requireTenantContext(await requireAuthContext(request));
        ensurePermission(auth, 'users.manage');
        const created = await createCompanyAccess(
          {
            actorUserId: auth.user.id,
            name: body.name,
            phone: body.phone,
            email: body.email,
            password: body.password,
            companies: body.companies,
          },
          getRequestMeta(request),
        );
        return status(201, created);
      } catch (error) {
        return toErrorResponse(error, status);
      }
    },
    { body: createMemberBodySchema },
  )
  .get(
    '/companies/members',
    async ({ query, request, status }) => {
      try {
        const auth = requireTenantContext(await requireAuthContext(request));
        ensurePermission(auth, 'users.read');
        const unassigned =
          query.unassigned === '1' || query.unassigned === 'true';

        return await listCompanyMembers(auth.tenant.id, {
          q: query.q,
          page: query.page,
          pageSize: query.pageSize,
          unassigned,
        });
      } catch (error) {
        return toErrorResponse(error, status);
      }
    },
    { query: memberListQuerySchema },
  )
  .delete(
    '/companies/members/:userId',
    async ({ params, request, status }) => {
      try {
        const auth = requireTenantContext(await requireAuthContext(request));
        ensurePermission(auth, 'users.manage');
        return await removeCompanyMember(
          {
            tenantId: auth.tenant.id,
            actorUserId: auth.user.id,
            targetUserId: params.userId,
            actorCanEditOwners: auth.permissions.includes('permissions.manage'),
          },
          getRequestMeta(request),
        );
      } catch (error) {
        return toErrorResponse(error, status);
      }
    },
    { params: memberParamsSchema },
  )
  .get('/companies/owned', async ({ request, status }) => {
    try {
      const auth = requireTenantContext(await requireAuthContext(request));
      const items = await listOwnedCompanies(auth.user.id);

      if (items.length === 0) {
        throw new AppError({
          statusCode: 403,
          code: 'NOT_COMPANY_OWNER',
          message: 'Only a company owner can list owned companies.',
        });
      }

      return { items };
    } catch (error) {
      return toErrorResponse(error, status);
    }
  })
  .post(
    '/companies',
    async ({ body, request, status }) => {
      try {
        const auth = requireTenantContext(await requireAuthContext(request));
        const created = await createOwnedCompany(
          {
            userId: auth.user.id,
            email: auth.user.email,
            name: body.name,
            description: body.description,
          },
          getRequestMeta(request),
        );
        return status(201, created);
      } catch (error) {
        return toErrorResponse(error, status);
      }
    },
    { body: createOwnedCompanyBodySchema },
  )
  .patch(
    '/companies/:tenantId',
    async ({ params, body, request, status }) => {
      try {
        const auth = requireTenantContext(await requireAuthContext(request));
        return await updateOwnedCompany(
          {
            actorUserId: auth.user.id,
            tenantId: params.tenantId,
            name: body.name,
            description: body.description,
          },
          getRequestMeta(request),
        );
      } catch (error) {
        return toErrorResponse(error, status);
      }
    },
    { params: companyParamsSchema, body: updateOwnedCompanyBodySchema },
  )
  .delete(
    '/companies/:tenantId/logo',
    async ({ params, request, status }) => {
      try {
        const auth = requireTenantContext(await requireAuthContext(request));
        const company = await readOwnedCompany(auth.user.id, params.tenantId);
        const files = await getFilesService();
        await files.clearLogo({
          tenantId: company.id,
          userId: auth.user.id,
          requestMeta: getRequestMeta(request),
        });
        return await readOwnedCompany(auth.user.id, params.tenantId);
      } catch (error) {
        return toErrorResponse(error, status);
      }
    },
    { params: companyParamsSchema },
  )
  .put(
    '/companies/members/:userId/team',
    async ({ params, body, request, status }) => {
      try {
        const auth = requireTenantContext(await requireAuthContext(request));
        ensurePermission(auth, 'teams.members.manage');
        return await assignCompanyMemberTeam(
          {
            tenantId: auth.tenant.id,
            actorUserId: auth.user.id,
            targetUserId: params.userId,
            teamId: body.teamId,
          },
          getRequestMeta(request),
        );
      } catch (error) {
        return toErrorResponse(error, status);
      }
    },
    { params: memberParamsSchema, body: assignTeamBodySchema },
  );
