# Controle de acessos da empresa — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O proprietário da empresa ativa convida uma conta existente, cria uma conta nova nas empresas que ele possui, vê departamentos e membros, e remove o acesso daquela empresa sem apagar a conta.

**Architecture:** As rotas novas entram no `managementRoutes` que `app.ts` já monta. A regra fica em `apps/api/src/modules/auth/company-access.ts` e usa `Membership`, `TeamMembership`, `Role` e `ActionLog`. A empresa da sessão é a empresa da tela. Criar acesso recebe a lista de empresas no corpo. A web acrescenta três rotas dentro do layout autenticado e dois itens na sidebar, só para `OWNER`.

**Tech Stack:** Bun, Elysia, Prisma 7, PostgreSQL, Vitest, React, TanStack Router, TanStack Query, Eden treaty, sidebar e componentes em `apps/web/src/components/ui`.

**Spec:** `docs/superpowers/specs/2026-11-23-controle-acessos-design.md`

## Global Constraints

- Só o `OWNER` da empresa ativa convida, cria, lista, remove ou troca departamento. `ADMIN` e `USER` recebem `403` `NOT_COMPANY_OWNER`.
- Convite e criação gravam papel de empresa `USER`. O corpo da criação não tem `role`. No convite, `role` omitido ou `"USER"`; outro valor é `422` `VALIDATION_ERROR`.
- Criar acesso exige que cada `tenantId` seja uma empresa em que o ator tem `Membership` `ACTIVE` de `OWNER`, e que cada `teamId` seja um `Team` ativo daquele tenant. Falha em um item não grava conta nem vínculo.
- Convite não cria `TeamMembership`. Criação cria `TeamMembership` `MEMBER`. `PUT` deixa um departamento `MEMBER`, preserva o líder quando a pessoa já está só naquele departamento, e responde `LAST_TEAM_LEADER` se ela for o único líder de um departamento que deixaria.
- Remover apaga o `Membership` da empresa ativa. A conta, as outras empresas, as sessões e `lastTenantId` permanecem. O único `OWNER` ativo não é removido: `409` `LAST_OWNER`.
- Não alterar `schema.prisma`, `service.ts`, `app.ts`, `StoredFile`, MinIO, nem a autorização de `POST /users`, `GET /users`, `POST /teams`, `GET /teams`, `POST /teams/:teamId/members` e `DELETE /teams/:teamId/members/:userId`.
- Antes de editar um arquivo da API, reler o arquivo. Conservar qualquer trecho de armazenamento de arquivo que outro trabalho tenha acrescentado.
- E-mails de teste terminam em `@auth-test.local`. Nomes de empresa de teste começam com `Auth Test`.
- Textos de erro da tela são os da tabela de erros da spec. A API usa as mensagens em inglês da mesma tabela.
- A segunda empresa de uma conta não passa por `POST /auth/companies`.

## Arquivos

- Criar: `apps/api/src/modules/auth/company-access.ts`
- Criar: `apps/api/src/modules/auth/http/company-access.flow.test.ts`
- Modificar: `apps/api/src/modules/auth/http/management.routes.ts`
- Modificar: `apps/api/src/modules/auth/http/auth-flow-client.ts`
- Criar: `apps/web/src/features/access/messages.ts`
- Criar: `apps/web/src/features/access/messages.test.ts`
- Criar: `apps/web/src/features/access/create-access-form.ts`
- Criar: `apps/web/src/features/access/create-access-form.test.ts`
- Criar: `apps/web/src/features/access/department-groups.ts`
- Criar: `apps/web/src/features/access/department-groups.test.ts`
- Criar: `apps/web/src/features/access/api.ts`
- Criar: `apps/web/src/features/access/owner-only.tsx`
- Criar: `apps/web/src/features/access/access-page.tsx`
- Criar: `apps/web/src/features/access/create-access-page.tsx`
- Criar: `apps/web/src/features/access/departments-page.tsx`
- Criar: `apps/web/src/features/access/sidebar-links.test.ts`
- Criar: `apps/web/src/routes/_authenticated/acessos/index.tsx`
- Criar: `apps/web/src/routes/_authenticated/acessos/novo.tsx`
- Criar: `apps/web/src/routes/_authenticated/departamentos.tsx`
- Modificar: `apps/web/src/features/auth/app-sidebar.tsx`
- Modificar: `apps/web/src/features/auth/authenticated-layout.tsx`
- Gerado pelo Vite, e então commitado: `apps/web/src/routeTree.gen.ts`

---

### Task 1: Convidar conta existente

**Files:**
- Create: `apps/api/src/modules/auth/company-access.ts`
- Create: `apps/api/src/modules/auth/http/company-access.flow.test.ts`
- Modify: `apps/api/src/modules/auth/http/management.routes.ts`
- Test: `apps/api/src/modules/auth/http/company-access.flow.test.ts`

**Interfaces:**
- Consumes: `requireAuthContext`, `requireTenantContext` de `service.ts`; `resolveTenantRoleId` de `tenant-bootstrap.ts`; `getRequestMeta`; `postAuth` e `getAuth` de `auth-flow-client.ts`; `cleanupAuthTests`.
- Produces: `ensureCompanyOwner(auth: { role: string | null }): void`. `inviteCompanyMember(input: { tenantId: string; actorUserId: string; email: string }, requestMeta: RequestMeta): Promise<{ userId: string; email: string; name: string; role: 'USER'; membershipId: string }>`. No teste: `registerOwner(label: string)` e `memberToken(ownerToken: string, roleName: 'ADMIN' | 'USER', label: string)`.

- [ ] **Step 1: Write the failing test**

Crie `apps/api/src/modules/auth/http/company-access.flow.test.ts`:

```ts
import { afterAll, describe, expect, it } from 'vitest';
import { getPrisma } from '../../../core/db/prisma';
import { asType } from '../db-types';
import { cleanupAuthTests, getAuth, postAuth } from './auth-flow-client';

const password = 'senha-forte';

afterAll(async () => {
  await cleanupAuthTests();
});

async function registerOwner(label: string): Promise<{
  email: string;
  accessToken: string;
  userId: string;
  tenantId: string;
  teamId: string;
}> {
  const email = `${label}-${crypto.randomUUID()}@auth-test.local`;
  const registered = await postAuth('/auth/register', {
    name: 'Dona Teste',
    phone: '11987654321',
    email,
    password,
  });
  expect(registered.status).toBe(201);
  const registeredTokens = registered.body.tokens as {
    accessToken: string;
    refreshToken: string;
  };
  const created = await postAuth(
    '/auth/companies',
    {
      name: `Auth Test ${label}`,
      description: 'Empresa de teste',
      refreshToken: registeredTokens.refreshToken,
    },
    registeredTokens.accessToken,
  );
  expect(created.status).toBe(200);
  const accessToken = (created.body.tokens as { accessToken: string }).accessToken;
  const tenantId = (created.body.tenant as { id: string }).id;
  const userId = (created.body.user as { id: string }).id;
  const teams = await getAuth('/teams', accessToken);
  expect(teams.status).toBe(200);
  const items = teams.body.items as Array<{ id: string; slug: string }>;
  const teamId = (items.find((team) => team.slug === 'geral') ?? items[0]).id;
  return { email, accessToken, userId, tenantId, teamId };
}

async function memberToken(
  ownerToken: string,
  roleName: 'ADMIN' | 'USER',
  label: string,
): Promise<{ email: string; accessToken: string; userId: string }> {
  const email = `${label}-${crypto.randomUUID()}@auth-test.local`;
  const created = await postAuth(
    '/users',
    {
      name: 'Pessoa Teste',
      email,
      password,
      roleName,
    },
    ownerToken,
  );
  expect(created.status).toBe(201);
  const login = await postAuth('/auth/login', { email, password });
  expect(login.status).toBe(200);
  return {
    email,
    accessToken: (login.body.tokens as { accessToken: string }).accessToken,
    userId: (login.body.user as { id: string }).id,
  };
}

describe('POST /companies/members/invite', () => {
  it('adds an existing account as USER without a department', async () => {
    const owner = await registerOwner('invite-owner');
    const guestEmail = `guest-${crypto.randomUUID()}@auth-test.local`;
    const guest = await postAuth('/auth/register', {
      name: 'Convidada',
      phone: '11911112222',
      email: guestEmail,
      password,
    });
    expect(guest.status).toBe(201);

    const response = await postAuth(
      '/companies/members/invite',
      { email: guestEmail.toUpperCase() },
      owner.accessToken,
    );
    const prisma = await getPrisma();
    const membership = asType<{ id: string; status: string; role: { name: string }; teams: unknown[] } | null>(
      await prisma.membership.findFirst({
        where: { tenantId: owner.tenantId, user: { email: guestEmail } },
        include: { role: true, teams: true },
      }),
    );
    const logs = asType<Array<{ action: string }>>(
      await prisma.actionLog.findMany({
        where: { action: 'members.invite', tenantId: owner.tenantId },
      }),
    );
    const guestLogin = await postAuth('/auth/login', { email: guestEmail, password });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      email: guestEmail,
      name: 'Convidada',
      role: 'USER',
    });
    expect(membership?.status).toBe('ACTIVE');
    expect(membership?.role.name).toBe('USER');
    expect(membership?.teams).toEqual([]);
    expect(logs).toHaveLength(1);
    expect(guestLogin.status).toBe(200);
    expect(guestLogin.body.companies).toEqual([
      expect.objectContaining({ id: owner.tenantId }),
    ]);
  });

  it('rejects an unknown email, a duplicate, a disabled account, and a non-owner', async () => {
    const owner = await registerOwner('invite-errors');
    const unknown = await postAuth(
      '/companies/members/invite',
      { email: `missing-${crypto.randomUUID()}@auth-test.local` },
      owner.accessToken,
    );
    const admin = await memberToken(owner.accessToken, 'ADMIN', 'invite-admin');
    const user = await memberToken(owner.accessToken, 'USER', 'invite-user');
    const duplicate = await postAuth(
      '/companies/members/invite',
      { email: admin.email },
      owner.accessToken,
    );
    const asAdmin = await postAuth(
      '/companies/members/invite',
      { email: owner.email },
      admin.accessToken,
    );
    const asUser = await postAuth(
      '/companies/members/invite',
      { email: owner.email },
      user.accessToken,
    );
    const badRole = await postAuth(
      '/companies/members/invite',
      { email: owner.email, role: 'OWNER' },
      owner.accessToken,
    );
    const anonymous = await postAuth('/companies/members/invite', {
      email: owner.email,
    });
    const registered = await postAuth('/auth/register', {
      name: 'Sem Empresa',
      phone: '11900001111',
      email: `bare-${crypto.randomUUID()}@auth-test.local`,
      password,
    });
    const noCompany = await postAuth(
      '/companies/members/invite',
      { email: owner.email },
      (registered.body.tokens as { accessToken: string }).accessToken,
    );
    const prisma = await getPrisma();
    const disabledEmail = `disabled-${crypto.randomUUID()}@auth-test.local`;
    await postAuth('/auth/register', {
      name: 'Inativa',
      phone: '11900002222',
      email: disabledEmail,
      password,
    });
    await prisma.user.update({
      where: { email: disabledEmail },
      data: { isActive: false },
    });
    const disabled = await postAuth(
      '/companies/members/invite',
      { email: disabledEmail },
      owner.accessToken,
    );

    expect(unknown.status).toBe(404);
    expect(unknown.body.error).toBe('USER_NOT_REGISTERED');
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error).toBe('ALREADY_IN_COMPANY');
    expect(asAdmin.status).toBe(403);
    expect(asAdmin.body.error).toBe('NOT_COMPANY_OWNER');
    expect(asUser.body.error).toBe('NOT_COMPANY_OWNER');
    expect(badRole.status).toBe(422);
    expect(badRole.body.error).toBe('VALIDATION_ERROR');
    expect(anonymous.status).toBe(401);
    expect(anonymous.body.error).toBe('UNAUTHORIZED');
    expect(noCompany.status).toBe(403);
    expect(noCompany.body.error).toBe('NO_ACTIVE_TENANT');
    expect(disabled.status).toBe(403);
    expect(disabled.body.error).toBe('USER_DISABLED');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd apps/api test -- src/modules/auth/http/company-access.flow.test.ts -t "invite"`

Expected: FAIL because `/companies/members/invite` responds 404.

- [ ] **Step 3: Write minimal implementation**

Crie `apps/api/src/modules/auth/company-access.ts`:

```ts
import { AppError } from '../../core/errors/app-error';
import { getPrisma } from '../../core/db/prisma';
import { asType } from './db-types';
import type { RequestMeta } from './request-meta';
import { resolveTenantRoleId } from './tenant-bootstrap';

export function ensureCompanyOwner(auth: { role: string | null }): void {
  if (auth.role !== 'OWNER') {
    throw new AppError({
      statusCode: 403,
      code: 'NOT_COMPANY_OWNER',
      message: 'Only the company owner can manage access.',
    });
  }
}

export async function inviteCompanyMember(
  input: { tenantId: string; actorUserId: string; email: string },
  requestMeta: RequestMeta,
): Promise<{
  userId: string;
  email: string;
  name: string;
  role: 'USER';
  membershipId: string;
}> {
  const email = input.email.trim().toLowerCase();
  const prisma = await getPrisma();

  return prisma.$transaction(async (transaction) => {
    const user = asType<{
      id: string;
      email: string;
      name: string;
      isActive: boolean;
    } | null>(
      await transaction.user.findUnique({
        where: { email },
        select: { id: true, email: true, name: true, isActive: true },
      }),
    );

    if (!user) {
      throw new AppError({
        statusCode: 404,
        code: 'USER_NOT_REGISTERED',
        message:
          'No account exists for this email. Create the access instead.',
      });
    }

    if (!user.isActive) {
      throw new AppError({
        statusCode: 403,
        code: 'USER_DISABLED',
        message: 'This account is disabled.',
      });
    }

    const existing = asType<{ id: string } | null>(
      await transaction.membership.findUnique({
        where: {
          tenantId_userId: { tenantId: input.tenantId, userId: user.id },
        },
        select: { id: true },
      }),
    );

    if (existing) {
      throw new AppError({
        statusCode: 409,
        code: 'ALREADY_IN_COMPANY',
        message: 'This person already belongs to this company.',
      });
    }

    const roleId = await resolveTenantRoleId(transaction, input.tenantId, 'USER');
    const membership = asType<{ id: string }>(
      await transaction.membership.create({
        data: {
          tenantId: input.tenantId,
          userId: user.id,
          roleId,
          status: 'ACTIVE',
        },
        select: { id: true },
      }),
    );

    await transaction.actionLog.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: 'members.invite',
        entityType: 'membership',
        entityId: membership.id,
        metadata: { userId: user.id, email: user.email },
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
      },
    });

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: 'USER',
      membershipId: membership.id,
    };
  });
}
```

Em `management.routes.ts`, reler o arquivo e acrescentar o import:

```ts
import { ensureCompanyOwner, inviteCompanyMember } from '../company-access';
```

Acrescentar o schema junto dos outros:

```ts
const inviteMemberBodySchema = t.Object({
  email: t.String({ format: 'email' }),
  role: t.Optional(t.Literal('USER')),
});
```

Encadear esta rota no `managementRoutes`, depois de `/action-logs`, conservando as rotas que já estiverem no arquivo:

```ts
.post(
  '/companies/members/invite',
  async ({ body, request, status }) => {
    try {
      const auth = requireTenantContext(await requireAuthContext(request));
      ensureCompanyOwner(auth);
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
```

`body.role` não é lido. O schema só deixa passar `USER` ou ausência.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd apps/api test -- src/modules/auth/http/company-access.flow.test.ts -t "invite"`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/company-access.ts apps/api/src/modules/auth/http/company-access.flow.test.ts apps/api/src/modules/auth/http/management.routes.ts
git commit -m "feat: invite an existing account into the active company"
```

---

### Task 2: Criar acesso nas empresas do proprietário

**Files:**
- Modify: `apps/api/src/modules/auth/company-access.ts`
- Modify: `apps/api/src/modules/auth/http/management.routes.ts`
- Modify: `apps/api/src/modules/auth/http/company-access.flow.test.ts`
- Test: `apps/api/src/modules/auth/http/company-access.flow.test.ts`

**Interfaces:**
- Consumes: `registerOwner` e `memberToken` do teste da Task 1; `normalizeName`, `normalizePhone`, `hashPassword`, `ensureTenantRbac`.
- Produces: `createCompanyAccess(input: { actorUserId: string; name: string; phone: string; email: string; password: string; companies: Array<{ tenantId: string; teamId: string }> }, requestMeta: RequestMeta)` com o corpo `201` da spec. No teste: `addOwnedCompany(userId: string, name: string, teamName: string)`.

- [ ] **Step 1: Write the failing test**

No teste, importe `ensureTenantRbac` de `../tenant-bootstrap` e acrescente o helper e o describe.

```ts
import { ensureTenantRbac } from '../tenant-bootstrap';

async function addOwnedCompany(
  userId: string,
  name: string,
  teamName: string,
): Promise<{ tenantId: string; teamId: string }> {
  const prisma = await getPrisma();
  const tenant = asType<{ id: string }>(
    await prisma.tenant.create({
      data: { name, slug: `auth-test-${crypto.randomUUID()}` },
    }),
  );
  const roleIds = await ensureTenantRbac(prisma, tenant.id);
  const membership = asType<{ id: string }>(
    await prisma.membership.create({
      data: {
        tenantId: tenant.id,
        userId,
        roleId: roleIds.OWNER,
        status: 'ACTIVE',
      },
      select: { id: true },
    }),
  );
  const team = asType<{ id: string }>(
    await prisma.team.create({
      data: {
        tenantId: tenant.id,
        slug: 'filial',
        name: teamName,
        isActive: true,
      },
      select: { id: true },
    }),
  );
  await prisma.teamMembership.create({
    data: { teamId: team.id, membershipId: membership.id, role: 'LEADER' },
  });
  return { tenantId: tenant.id, teamId: team.id };
}

describe('POST /companies/members', () => {
  it('creates one account in every company the actor owns', async () => {
    const owner = await registerOwner('create-owner');
    const second = await addOwnedCompany(
      owner.userId,
      'Auth Test z filial',
      'Filial',
    );
    const email = `created-${crypto.randomUUID()}@auth-test.local`;
    const response = await postAuth(
      '/companies/members',
      {
        name: ' Nova Pessoa ',
        phone: ' (11) 98888-7777 ',
        email: email.toUpperCase(),
        password,
        companies: [
          { tenantId: owner.tenantId, teamId: owner.teamId },
          { tenantId: second.tenantId, teamId: second.teamId },
        ],
      },
      owner.accessToken,
    );
    const login = await postAuth('/auth/login', { email, password });
    const prisma = await getPrisma();
    const logs = asType<Array<{ tenantId: string; action: string }>>(
      await prisma.actionLog.findMany({
        where: { action: 'members.create', metadata: { path: ['email'], equals: email } },
      }),
    );

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({
      name: 'Nova Pessoa',
      email,
      phone: '(11) 98888-7777',
    });
    expect(response.body).not.toHaveProperty('password');
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    const memberships = response.body.memberships as Array<{
      tenantId: string;
      role: string;
      team: { id: string };
    }>;
    expect(memberships.map((item) => item.tenantId)).toEqual([
      owner.tenantId,
      second.tenantId,
    ]);
    expect(memberships.every((item) => item.role === 'USER')).toBe(true);
    expect(memberships.map((item) => item.team.id)).toEqual([
      owner.teamId,
      second.teamId,
    ]);
    expect(login.status).toBe(200);
    expect(login.body.companies).toEqual([
      expect.objectContaining({ id: owner.tenantId }),
      expect.objectContaining({ id: second.tenantId }),
    ]);
    expect(logs).toHaveLength(2);
  });

  it('rejects email in use, a company the actor does not own, a foreign department, and duplicates', async () => {
    const owner = await registerOwner('create-errors');
    const other = await registerOwner('create-other');
    const second = await addOwnedCompany(
      owner.userId,
      'Auth Test Outra Filial',
      'Filial',
    );
    const email = `blocked-${crypto.randomUUID()}@auth-test.local`;
    const foreignTeam = await postAuth(
      '/companies/members',
      {
        name: 'Bloqueada',
        phone: '11987654321',
        email,
        password,
        companies: [{ tenantId: owner.tenantId, teamId: second.teamId }],
      },
      owner.accessToken,
    );
    const notOwned = await postAuth(
      '/companies/members',
      {
        name: 'Bloqueada',
        phone: '11987654321',
        email,
        password,
        companies: [{ tenantId: other.tenantId, teamId: other.teamId }],
      },
      owner.accessToken,
    );
    const duplicateCompany = await postAuth(
      '/companies/members',
      {
        name: 'Bloqueada',
        phone: '11987654321',
        email,
        password,
        companies: [
          { tenantId: owner.tenantId, teamId: owner.teamId },
          { tenantId: owner.tenantId, teamId: owner.teamId },
        ],
      },
      owner.accessToken,
    );
    const emptyList = await postAuth(
      '/companies/members',
      {
        name: 'Bloqueada',
        phone: '11987654321',
        email,
        password,
        companies: [],
      },
      owner.accessToken,
    );
    const taken = await postAuth(
      '/companies/members',
      {
        name: 'Bloqueada',
        phone: '11987654321',
        email: owner.email,
        password,
        companies: [{ tenantId: owner.tenantId, teamId: owner.teamId }],
      },
      owner.accessToken,
    );
    const admin = await memberToken(owner.accessToken, 'ADMIN', 'create-admin');
    const adminCompany = await addOwnedCompany(
      admin.userId,
      'Auth Test Do Admin',
      'Filial',
    );
    const asAdmin = await postAuth(
      '/companies/members',
      {
        name: 'Bloqueada',
        phone: '11987654321',
        email: `admin-try-${crypto.randomUUID()}@auth-test.local`,
        password,
        companies: [
          { tenantId: adminCompany.tenantId, teamId: adminCompany.teamId },
        ],
      },
      admin.accessToken,
    );
    const prisma = await getPrisma();
    const createdUser = await prisma.user.findUnique({ where: { email } });

    expect(foreignTeam.status).toBe(400);
    expect(foreignTeam.body.error).toBe('TEAM_NOT_IN_COMPANY');
    expect(notOwned.status).toBe(403);
    expect(notOwned.body.error).toBe('COMPANY_NOT_OWNED');
    expect(duplicateCompany.status).toBe(400);
    expect(duplicateCompany.body.error).toBe('DUPLICATE_COMPANY');
    expect(emptyList.status).toBe(422);
    expect(emptyList.body.error).toBe('VALIDATION_ERROR');
    expect(taken.status).toBe(409);
    expect(taken.body.error).toBe('EMAIL_IN_USE');
    expect(asAdmin.status).toBe(403);
    expect(asAdmin.body.error).toBe('NOT_COMPANY_OWNER');
    expect(createdUser).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd apps/api test -- src/modules/auth/http/company-access.flow.test.ts -t "creates one account|rejects email"`

Expected: FAIL because `POST /companies/members` responds 404.

- [ ] **Step 3: Write minimal implementation**

Em `company-access.ts`, acrescente os imports `normalizeName` de `./input-rules`, `hashPassword` de `./password` e `normalizePhone` de `./phone`. Acrescente a função:

```ts
export async function createCompanyAccess(
  input: {
    actorUserId: string;
    name: string;
    phone: string;
    email: string;
    password: string;
    companies: Array<{ tenantId: string; teamId: string }>;
  },
  requestMeta: RequestMeta,
): Promise<{
  user: { id: string; name: string; email: string; phone: string };
  memberships: Array<{
    tenantId: string;
    membershipId: string;
    role: 'USER';
    team: { id: string; name: string; slug: string };
  }>;
}> {
  const tenantIds = input.companies.map((company) => company.tenantId);
  if (new Set(tenantIds).size !== tenantIds.length) {
    throw new AppError({
      statusCode: 400,
      code: 'DUPLICATE_COMPANY',
      message: 'Each company can appear only once.',
    });
  }

  const name = normalizeName(input.name, 'Name');
  const phone = normalizePhone(input.phone);
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);
  const prisma = await getPrisma();

  return prisma.$transaction(async (transaction) => {
    const owned = asType<Array<{ tenantId: string }>>(
      await transaction.membership.findMany({
        where: {
          userId: input.actorUserId,
          status: 'ACTIVE',
          tenantId: { in: tenantIds },
          role: { name: 'OWNER' },
        },
        select: { tenantId: true },
      }),
    );

    if (owned.length !== tenantIds.length) {
      throw new AppError({
        statusCode: 403,
        code: 'COMPANY_NOT_OWNED',
        message: 'You can only add this person to a company you own.',
      });
    }

    const teams = asType<
      Array<{ id: string; tenantId: string; name: string; slug: string }>
    >(
      await transaction.team.findMany({
        where: {
          isActive: true,
          OR: input.companies.map((company) => ({
            id: company.teamId,
            tenantId: company.tenantId,
          })),
        },
        select: { id: true, tenantId: true, name: true, slug: true },
      }),
    );
    const teamByPair = new Map(
      teams.map((team) => [`${team.tenantId}:${team.id}`, team]),
    );

    if (
      input.companies.some(
        (company) => !teamByPair.has(`${company.tenantId}:${company.teamId}`),
      )
    ) {
      throw new AppError({
        statusCode: 400,
        code: 'TEAM_NOT_IN_COMPANY',
        message: 'The department does not belong to this company.',
      });
    }

    const existingUser = asType<{ id: string } | null>(
      await transaction.user.findUnique({
        where: { email },
        select: { id: true },
      }),
    );

    if (existingUser) {
      throw new AppError({
        statusCode: 409,
        code: 'EMAIL_IN_USE',
        message: 'Email is already in use.',
      });
    }

    const user = asType<{
      id: string;
      name: string;
      email: string;
      phone: string;
    }>(
      await transaction.user.create({
        data: { email, name, phone, passwordHash, isActive: true },
        select: { id: true, name: true, email: true, phone: true },
      }),
    );

    const memberships = [];
    for (const company of input.companies) {
      const team = teamByPair.get(`${company.tenantId}:${company.teamId}`);
      if (!team) {
        throw new AppError({
          statusCode: 400,
          code: 'TEAM_NOT_IN_COMPANY',
          message: 'The department does not belong to this company.',
        });
      }
      const roleId = await resolveTenantRoleId(
        transaction,
        company.tenantId,
        'USER',
      );
      const membership = asType<{ id: string }>(
        await transaction.membership.create({
          data: {
            tenantId: company.tenantId,
            userId: user.id,
            roleId,
            status: 'ACTIVE',
          },
          select: { id: true },
        }),
      );
      await transaction.teamMembership.create({
        data: {
          teamId: team.id,
          membershipId: membership.id,
          role: 'MEMBER',
        },
      });
      await transaction.actionLog.create({
        data: {
          tenantId: company.tenantId,
          teamId: team.id,
          actorUserId: input.actorUserId,
          action: 'members.create',
          entityType: 'membership',
          entityId: membership.id,
          metadata: { userId: user.id, email: user.email, teamId: team.id },
          ipAddress: requestMeta.ipAddress,
          userAgent: requestMeta.userAgent,
        },
      });
      memberships.push({
        tenantId: company.tenantId,
        membershipId: membership.id,
        role: 'USER' as const,
        team: { id: team.id, name: team.name, slug: team.slug },
      });
    }

    return { user, memberships };
  });
}
```

Em `management.routes.ts`, importe `createCompanyAccess` e acrescente:

```ts
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
```

Rota, depois do convite:

```ts
.post(
  '/companies/members',
  async ({ body, request, status }) => {
    try {
      const auth = requireTenantContext(await requireAuthContext(request));
      ensureCompanyOwner(auth);
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd apps/api test -- src/modules/auth/http/company-access.flow.test.ts -t "POST /companies/members"`

Expected: PASS, incluindo o describe do convite se o filtro pegar os dois. Se o filtro separar, rode também `-t invite` e confirme PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/company-access.ts apps/api/src/modules/auth/http/management.routes.ts apps/api/src/modules/auth/http/company-access.flow.test.ts
git commit -m "feat: create an account into companies the owner controls"
```

---

### Task 3: Listar e remover o acesso de uma empresa

**Files:**
- Modify: `apps/api/src/modules/auth/company-access.ts`
- Modify: `apps/api/src/modules/auth/http/management.routes.ts`
- Modify: `apps/api/src/modules/auth/http/auth-flow-client.ts`
- Modify: `apps/api/src/modules/auth/http/company-access.flow.test.ts`
- Test: `apps/api/src/modules/auth/http/company-access.flow.test.ts`

**Interfaces:**
- Consumes: `createCompanyAccess` e `registerOwner`. `deleteAuth(path: string, accessToken: string)` passa a existir no cliente de teste.
- Produces: `listCompanyMembers(tenantId: string)` e `removeCompanyMember(input: { tenantId: string; actorUserId: string; targetUserId: string }, requestMeta: RequestMeta): Promise<{ removed: true }>`.

- [ ] **Step 1: Write the failing test**

Em `auth-flow-client.ts`, acrescente e exporte:

```ts
export async function deleteAuth(
  path: string,
  accessToken: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await app.handle(
    new Request(`http://localhost${path}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${accessToken}` },
    }),
  );

  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}
```

No teste, importe `deleteAuth`. Acrescente:

```ts
describe('company member list and removal', () => {
  it('lists the active company and removes one membership', async () => {
    const owner = await registerOwner('list-owner');
    const second = await addOwnedCompany(owner.userId, 'Auth Test Permanece', 'Filial');
    const email = `listed-${crypto.randomUUID()}@auth-test.local`;
    const created = await postAuth(
      '/companies/members',
      {
        name: 'Listada',
        phone: '11987654321',
        email,
        password,
        companies: [
          { tenantId: owner.tenantId, teamId: owner.teamId },
          { tenantId: second.tenantId, teamId: second.teamId },
        ],
      },
      owner.accessToken,
    );
    expect(created.status).toBe(201);
    const createdUserId = (created.body.user as { id: string }).id;
    const listed = await getAuth('/companies/members', owner.accessToken);
    const items = listed.body.items as Array<{
      userId: string;
      email: string;
      role: string;
      team: { id: string } | null;
    }>;
    const sessionBefore = await postAuth('/auth/login', { email, password });
    expect(sessionBefore.status).toBe(200);
    const tokenBefore = (sessionBefore.body.tokens as { accessToken: string })
      .accessToken;
    const removed = await deleteAuth(
      `/companies/members/${createdUserId}`,
      owner.accessToken,
    );
    const after = await getAuth('/companies/members', owner.accessToken);
    const denied = await getAuth('/auth/me', tokenBefore);
    const login = await postAuth('/auth/login', { email, password });
    const prisma = await getPrisma();
    const user = await prisma.user.findUnique({ where: { email } });
    const logs = asType<Array<{ action: string }>>(
      await prisma.actionLog.findMany({
        where: { action: 'members.remove', tenantId: owner.tenantId },
      }),
    );

    expect(listed.status).toBe(200);
    expect(items.map((item) => item.email).sort()).toEqual(
      [owner.email, email].sort(),
    );
    expect(items.find((item) => item.email === email)?.role).toBe('USER');
    expect(items.find((item) => item.email === email)?.team?.id).toBe(owner.teamId);
    expect(removed).toMatchObject({ status: 200, body: { removed: true } });
    expect(
      (after.body.items as Array<{ email: string }>).some((item) => item.email === email),
    ).toBe(false);
    expect(user).not.toBeNull();
    expect(login.status).toBe(200);
    expect(login.body.companies).toEqual([
      expect.objectContaining({ id: second.tenantId }),
    ]);
    expect(logs).toHaveLength(1);
    expect(denied.status).toBe(401);
    expect(denied.body.error).toBe('UNAUTHORIZED');
  });

  it('keeps the last owner and rejects a missing member', async () => {
    const owner = await registerOwner('last-owner');
    const self = await deleteAuth(
      `/companies/members/${owner.userId}`,
      owner.accessToken,
    );
    const missing = await deleteAuth(
      `/companies/members/${crypto.randomUUID()}`,
      owner.accessToken,
    );
    const secondOwner = await postAuth(
      '/users',
      {
        name: 'Outro Dono',
        email: `co-owner-${crypto.randomUUID()}@auth-test.local`,
        password,
        roleName: 'OWNER',
      },
      owner.accessToken,
    );
    expect(secondOwner.status).toBe(201);
    const removedOwner = await deleteAuth(
      `/companies/members/${(secondOwner.body as { id: string }).id}`,
      owner.accessToken,
    );
    const prisma = await getPrisma();
    const ownerMembership = await prisma.membership.findUnique({
      where: {
        tenantId_userId: { tenantId: owner.tenantId, userId: owner.userId },
      },
    });

    expect(self.status).toBe(409);
    expect(self.body.error).toBe('LAST_OWNER');
    expect(ownerMembership).not.toBeNull();
    expect(missing.status).toBe(404);
    expect(missing.body.error).toBe('MEMBERSHIP_NOT_FOUND');
    expect(removedOwner.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd apps/api test -- src/modules/auth/http/company-access.flow.test.ts -t "company member list"`

Expected: FAIL because `GET /companies/members` responds 404.

- [ ] **Step 3: Write minimal implementation**

Acrescente em `company-access.ts`:

```ts
export async function listCompanyMembers(tenantId: string): Promise<
  Array<{
    userId: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    team: { id: string; name: string; slug: string } | null;
  }>
> {
  const prisma = await getPrisma();
  const memberships = asType<
    Array<{
      user: { id: string; name: string; email: string; phone: string };
      role: { name: string };
      teams: Array<{
        team: { id: string; name: string; slug: string };
      }>;
    }>
  >(
    await prisma.membership.findMany({
      where: { tenantId, status: 'ACTIVE' },
      select: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        role: { select: { name: true } },
        teams: {
          select: {
            createdAt: true,
            team: { select: { id: true, name: true, slug: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [{ user: { name: 'asc' } }, { user: { email: 'asc' } }],
    }),
  );

  return memberships.map((membership) => ({
    userId: membership.user.id,
    name: membership.user.name,
    email: membership.user.email,
    phone: membership.user.phone,
    role: membership.role.name,
    team: membership.teams[0]?.team ?? null,
  }));
}

export async function removeCompanyMember(
  input: { tenantId: string; actorUserId: string; targetUserId: string },
  requestMeta: RequestMeta,
): Promise<{ removed: true }> {
  const prisma = await getPrisma();

  return prisma.$transaction(async (transaction) => {
    const membership = asType<{
      id: string;
      status: string;
      role: { name: string };
      user: { id: string; email: string };
    } | null>(
      await transaction.membership.findUnique({
        where: {
          tenantId_userId: {
            tenantId: input.tenantId,
            userId: input.targetUserId,
          },
        },
        select: {
          id: true,
          status: true,
          role: { select: { name: true } },
          user: { select: { id: true, email: true } },
        },
      }),
    );

    if (!membership) {
      throw new AppError({
        statusCode: 404,
        code: 'MEMBERSHIP_NOT_FOUND',
        message: 'This person does not belong to this company.',
      });
    }

    if (membership.status === 'ACTIVE' && membership.role.name === 'OWNER') {
      const ownerCount = asType<number>(
        await transaction.membership.count({
          where: {
            tenantId: input.tenantId,
            status: 'ACTIVE',
            role: { name: 'OWNER' },
          },
        }),
      );

      if (ownerCount <= 1) {
        throw new AppError({
          statusCode: 409,
          code: 'LAST_OWNER',
          message: 'The last owner of this company cannot be removed.',
        });
      }
    }

    await transaction.actionLog.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: 'members.remove',
        entityType: 'membership',
        entityId: membership.id,
        metadata: { userId: membership.user.id, email: membership.user.email },
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
      },
    });

    await transaction.membership.delete({ where: { id: membership.id } });
    return { removed: true };
  });
}
```

O `delete` do `Membership` deixa o cascade de `TeamMembership` apagar o departamento daquela empresa. Não apague `User` nem outros `Membership`.

Rotas em `management.routes.ts`:

```ts
const memberParamsSchema = t.Object({
  userId: t.String({ minLength: 1 }),
});
```

```ts
.get('/companies/members', async ({ request, status }) => {
  try {
    const auth = requireTenantContext(await requireAuthContext(request));
    ensureCompanyOwner(auth);
    return { items: await listCompanyMembers(auth.tenant.id) };
  } catch (error) {
    return toErrorResponse(error, status);
  }
})
.delete(
  '/companies/members/:userId',
  async ({ params, request, status }) => {
    try {
      const auth = requireTenantContext(await requireAuthContext(request));
      ensureCompanyOwner(auth);
      return await removeCompanyMember(
        {
          tenantId: auth.tenant.id,
          actorUserId: auth.user.id,
          targetUserId: params.userId,
        },
        getRequestMeta(request),
      );
    } catch (error) {
      return toErrorResponse(error, status);
    }
  },
  { params: memberParamsSchema },
)
```

Importe `listCompanyMembers` e `removeCompanyMember`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd apps/api test -- src/modules/auth/http/company-access.flow.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/company-access.ts apps/api/src/modules/auth/http/management.routes.ts apps/api/src/modules/auth/http/auth-flow-client.ts apps/api/src/modules/auth/http/company-access.flow.test.ts
git commit -m "feat: list and remove company access"
```

---

### Task 4: Departamento e empresas do proprietário

**Files:**
- Modify: `apps/api/src/modules/auth/company-access.ts`
- Modify: `apps/api/src/modules/auth/http/management.routes.ts`
- Modify: `apps/api/src/modules/auth/http/auth-flow-client.ts`
- Modify: `apps/api/src/modules/auth/http/company-access.flow.test.ts`
- Test: `apps/api/src/modules/auth/http/company-access.flow.test.ts`

**Interfaces:**
- Consumes: `listCompanyMembers`, `registerOwner`, `addOwnedCompany`. `putAuth(path, body, accessToken)` no cliente de teste.
- Produces: `assignCompanyMemberTeam(input: { tenantId: string; actorUserId: string; targetUserId: string; teamId: string }, requestMeta: RequestMeta): Promise<{ userId: string; teamId: string; role: 'LEADER' | 'MEMBER' }>`. `listOwnedCompanies(actorUserId: string)`.

- [ ] **Step 1: Write the failing test**

Em `auth-flow-client.ts`, acrescente `putAuth` com método `PUT`, header `content-type: application/json` e o Bearer, no mesmo formato de `postAuth`.

No teste, importe `putAuth` e acrescente:

```ts
describe('department assignment and owned companies', () => {
  it('moves a member into one department of the active company', async () => {
    const owner = await registerOwner('team-owner');
    const guestEmail = `team-guest-${crypto.randomUUID()}@auth-test.local`;
    await postAuth('/auth/register', {
      name: 'Sem Time',
      phone: '11987654321',
      email: guestEmail,
      password,
    });
    const invited = await postAuth(
      '/companies/members/invite',
      { email: guestEmail },
      owner.accessToken,
    );
    const guestId = invited.body.userId as string;
    const before = await getAuth('/companies/members', owner.accessToken);
    const assigned = await putAuth(
      `/companies/members/${guestId}/team`,
      { teamId: owner.teamId },
      owner.accessToken,
    );
    const again = await putAuth(
      `/companies/members/${guestId}/team`,
      { teamId: owner.teamId },
      owner.accessToken,
    );
    const after = await getAuth('/companies/members', owner.accessToken);
    const second = await addOwnedCompany(owner.userId, 'Auth Test Time Alheio', 'Filial');
    const foreign = await putAuth(
      `/companies/members/${guestId}/team`,
      { teamId: second.teamId },
      owner.accessToken,
    );
    const moveOwner = await putAuth(
      `/companies/members/${owner.userId}/team`,
      { teamId: owner.teamId },
      owner.accessToken,
    );
    const prisma = await getPrisma();
    const extraTeam = asType<{ id: string }>(
      await prisma.team.create({
        data: {
          tenantId: owner.tenantId,
          slug: `extra-${crypto.randomUUID()}`,
          name: 'Extra',
          isActive: true,
        },
        select: { id: true },
      }),
    );
    const blocked = await putAuth(
      `/companies/members/${owner.userId}/team`,
      { teamId: extraTeam.id },
      owner.accessToken,
    );
    const logs = asType<unknown[]>(
      await prisma.actionLog.findMany({
        where: { action: 'members.team_assign', tenantId: owner.tenantId },
      }),
    );
    const guestBefore = (before.body.items as Array<{ userId: string; team: unknown }>).find(
      (item) => item.userId === guestId,
    );

    expect(guestBefore?.team).toBeNull();
    expect(assigned).toMatchObject({
      status: 200,
      body: { userId: guestId, teamId: owner.teamId, role: 'MEMBER' },
    });
    expect(again.body).toMatchObject({ role: 'MEMBER' });
    expect(
      (after.body.items as Array<{ userId: string; team: { id: string } | null }>).find(
        (item) => item.userId === guestId,
      )?.team?.id,
    ).toBe(owner.teamId);
    expect(foreign.status).toBe(400);
    expect(foreign.body.error).toBe('TEAM_NOT_IN_COMPANY');
    expect(moveOwner.body).toMatchObject({ role: 'LEADER' });
    expect(blocked.status).toBe(400);
    expect(blocked.body.error).toBe('LAST_TEAM_LEADER');
    expect(logs).toHaveLength(1);
  });

  it('lists only companies the actor owns, with active teams', async () => {
    const owner = await registerOwner('owned-list');
    const second = await addOwnedCompany(owner.userId, 'Auth Test a filial', 'Filial');
    const admin = await memberToken(owner.accessToken, 'ADMIN', 'owned-admin');
    const listed = await getAuth('/companies/owned', owner.accessToken);
    const asAdmin = await getAuth('/companies/owned', admin.accessToken);
    const teams = await getAuth('/teams', owner.accessToken);
    const firstTeam = (teams.body.items as Array<{ memberCount: number; permissionKeys: string[] }>)[0];

    expect(listed.status).toBe(200);
    expect(listed.body.items).toEqual([
      expect.objectContaining({
        id: second.tenantId,
        teams: [expect.objectContaining({ id: second.teamId, name: 'Filial' })],
      }),
      expect.objectContaining({
        id: owner.tenantId,
        teams: [expect.objectContaining({ slug: 'geral' })],
      }),
    ]);
    expect(asAdmin.status).toBe(403);
    expect(asAdmin.body.error).toBe('NOT_COMPANY_OWNER');
    expect(firstTeam.memberCount).toBeGreaterThan(0);
    expect(Array.isArray(firstTeam.permissionKeys)).toBe(true);
  });
});
```

`Auth Test a filial` ordena antes de `Auth Test owned-list` porque `a` vem antes de `o`. O `toEqual` do teste já está nessa ordem. O login da conta criada ordena com `localeCompare` `pt-BR` em `listActiveCompanies`: `Auth Test create-owner` vem antes de `Auth Test z filial`.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd apps/api test -- src/modules/auth/http/company-access.flow.test.ts -t "department assignment"`

Expected: FAIL because `PUT /companies/members/:userId/team` responds 404.

- [ ] **Step 3: Write minimal implementation**

Acrescente em `company-access.ts`:

```ts
export async function assignCompanyMemberTeam(
  input: {
    tenantId: string;
    actorUserId: string;
    targetUserId: string;
    teamId: string;
  },
  requestMeta: RequestMeta,
): Promise<{ userId: string; teamId: string; role: 'LEADER' | 'MEMBER' }> {
  const prisma = await getPrisma();

  return prisma.$transaction(async (transaction) => {
    const membership = asType<{
      id: string;
      status: string;
      teams: Array<{ teamId: string; role: 'LEADER' | 'MEMBER' }>;
    } | null>(
      await transaction.membership.findUnique({
        where: {
          tenantId_userId: {
            tenantId: input.tenantId,
            userId: input.targetUserId,
          },
        },
        select: {
          id: true,
          status: true,
          teams: { select: { teamId: true, role: true } },
        },
      }),
    );

    if (!membership || membership.status !== 'ACTIVE') {
      throw new AppError({
        statusCode: 404,
        code: 'MEMBERSHIP_NOT_FOUND',
        message: 'This person does not belong to this company.',
      });
    }

    const team = asType<{ id: string } | null>(
      await transaction.team.findFirst({
        where: { id: input.teamId, tenantId: input.tenantId, isActive: true },
        select: { id: true },
      }),
    );

    if (!team) {
      throw new AppError({
        statusCode: 400,
        code: 'TEAM_NOT_IN_COMPANY',
        message: 'The department does not belong to this company.',
      });
    }

    if (membership.teams.length === 1 && membership.teams[0]?.teamId === team.id) {
      return {
        userId: input.targetUserId,
        teamId: team.id,
        role: membership.teams[0].role,
      };
    }

    for (const current of membership.teams) {
      if (current.teamId === team.id || current.role !== 'LEADER') {
        continue;
      }
      const leaderCount = asType<number>(
        await transaction.teamMembership.count({
          where: { teamId: current.teamId, role: 'LEADER' },
        }),
      );
      if (leaderCount <= 1) {
        throw new AppError({
          statusCode: 400,
          code: 'LAST_TEAM_LEADER',
          message: 'This person is the last leader of their current department.',
        });
      }
    }

    const previousTeamIds = membership.teams.map((current) => current.teamId);
    await transaction.teamMembership.deleteMany({
      where: { membershipId: membership.id },
    });
    await transaction.teamMembership.create({
      data: { teamId: team.id, membershipId: membership.id, role: 'MEMBER' },
    });
    await transaction.actionLog.create({
      data: {
        tenantId: input.tenantId,
        teamId: team.id,
        actorUserId: input.actorUserId,
        action: 'members.team_assign',
        entityType: 'membership',
        entityId: membership.id,
        metadata: { userId: input.targetUserId, previousTeamIds },
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
      },
    });

    return { userId: input.targetUserId, teamId: team.id, role: 'MEMBER' };
  });
}

export async function listOwnedCompanies(actorUserId: string): Promise<
  Array<{
    id: string;
    slug: string;
    name: string;
    teams: Array<{ id: string; slug: string; name: string }>;
  }>
> {
  const prisma = await getPrisma();
  const memberships = asType<
    Array<{
      tenant: {
        id: string;
        slug: string;
        name: string;
        teams: Array<{ id: string; slug: string; name: string }>;
      };
    }>
  >(
    await prisma.membership.findMany({
      where: {
        userId: actorUserId,
        status: 'ACTIVE',
        role: { name: 'OWNER' },
      },
      select: {
        tenant: {
          select: {
            id: true,
            slug: true,
            name: true,
            teams: {
              where: { isActive: true },
              select: { id: true, slug: true, name: true },
              orderBy: { name: 'asc' },
            },
          },
        },
      },
      orderBy: { tenant: { name: 'asc' } },
    }),
  );

  return memberships.map((membership) => membership.tenant);
}
```

Rotas:

```ts
const assignTeamBodySchema = t.Object({
  teamId: t.String({ minLength: 1 }),
});
```

```ts
.get('/companies/owned', async ({ request, status }) => {
  try {
    const auth = requireTenantContext(await requireAuthContext(request));
    ensureCompanyOwner(auth);
    return { items: await listOwnedCompanies(auth.user.id) };
  } catch (error) {
    return toErrorResponse(error, status);
  }
})
.put(
  '/companies/members/:userId/team',
  async ({ params, body, request, status }) => {
    try {
      const auth = requireTenantContext(await requireAuthContext(request));
      ensureCompanyOwner(auth);
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
)
```

Não altere o handler de `GET /teams`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd apps/api test -- src/modules/auth/http/company-access.flow.test.ts`

Expected: PASS

Run: `bun run --cwd apps/api check`

Expected: o TypeScript termina sem erro.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/company-access.ts apps/api/src/modules/auth/http/management.routes.ts apps/api/src/modules/auth/http/auth-flow-client.ts apps/api/src/modules/auth/http/company-access.flow.test.ts
git commit -m "feat: assign a department and list owned companies"
```

---

### Task 5: Regras puras das telas

**Files:**
- Create: `apps/web/src/features/access/messages.ts`
- Create: `apps/web/src/features/access/messages.test.ts`
- Create: `apps/web/src/features/access/create-access-form.ts`
- Create: `apps/web/src/features/access/create-access-form.test.ts`
- Create: `apps/web/src/features/access/department-groups.ts`
- Create: `apps/web/src/features/access/department-groups.test.ts`
- Test: os três arquivos `*.test.ts` acima

**Interfaces:**
- Consumes: os códigos e as frases da tabela de erros da spec.
- Produces: `roleLabel(role: string): string`. `accessErrorMessage(code: string): string`. `OwnedCompanyOption`. `CreateAccessSelection`. `preferredTeamId`. `initialCreateAccessSelection(companies, activeTenantId)`. `toggleOwnedCompany(selection, company, checked)`. `selectDepartment(selection, tenantId, teamId)`. `createAccessFormError(...)`. `toCreateAccessBody(...)`. `membersOfTeam(members, teamId)`. `unassignedMembers(members, activeTeamIds)`.

- [ ] **Step 1: Write the failing test**

`messages.test.ts` espera `roleLabel('OWNER')` igual a `Proprietário`, `ADMIN` igual a `Administrador`, `USER` igual a `Usuário`, e um papel desconhecido devolvido como veio. Espera `accessErrorMessage` com cada frase da coluna "Texto na tela" da spec, e um código desconhecido igual a `Não foi possível concluir. Tente de novo.`

`create-access-form.test.ts` usa duas empresas. A ativa tem times `geral` e `filial`. A outra só tem `filial`.

- `initialCreateAccessSelection` marca só a ativa e escolhe o id do slug `geral`.
- Sem slug `geral`, escolhe o primeiro time do array.
- Se a ativa não está na lista, `tenantIds` fica vazio.
- `toggleOwnedCompany(..., false)` tira a empresa e a chave do departamento.
- `toggleOwnedCompany(..., true)` na segunda empresa acrescenta o id e o time `filial`.
- `selectDepartment` troca o time da empresa marcada.
- `createAccessFormError` devolve, nesta ordem de precedência: nome com um caractere, senha com 7 caracteres, nenhuma empresa, empresa marcada sem time. Entrada válida devolve `null`.
- `toCreateAccessBody` corta espaços de nome, telefone e e-mail e monta `companies` na ordem de `tenantIds`.

`department-groups.test.ts`: `membersOfTeam` devolve quem tem aquele `team.id`. `unassignedMembers` devolve quem tem `team` nulo e quem aponta para um id fora do `Set` de departamentos ativos.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd apps/web test -- src/features/access`

Expected: FAIL because the modules are missing.

- [ ] **Step 3: Write minimal implementation**

`messages.ts` guarda o mapa de códigos da spec, inclusive `VALIDATION_ERROR`: `Revise os campos e tente de novo.` `EMAIL_IN_USE` nesta tela é `Este e-mail já tem conta. Convide a pessoa em vez de criar outro acesso.`

`create-access-form.ts`:

```ts
export interface OwnedCompanyOption {
  id: string;
  name: string;
  teams: Array<{ id: string; slug: string; name: string }>;
}

export interface CreateAccessSelection {
  tenantIds: string[];
  teamByTenant: Record<string, string>;
}

export function preferredTeamId(
  teams: OwnedCompanyOption['teams'],
): string | null {
  return teams.find((team) => team.slug === 'geral')?.id ?? teams[0]?.id ?? null;
}

export function initialCreateAccessSelection(
  companies: OwnedCompanyOption[],
  activeTenantId: string,
): CreateAccessSelection {
  const active = companies.find((company) => company.id === activeTenantId);
  const teamId = active ? preferredTeamId(active.teams) : null;
  if (!active || !teamId) {
    return { tenantIds: [], teamByTenant: {} };
  }
  return { tenantIds: [active.id], teamByTenant: { [active.id]: teamId } };
}

export function toggleOwnedCompany(
  selection: CreateAccessSelection,
  company: OwnedCompanyOption,
  checked: boolean,
): CreateAccessSelection {
  if (!checked) {
    const teamByTenant = { ...selection.teamByTenant };
    delete teamByTenant[company.id];
    return {
      tenantIds: selection.tenantIds.filter((id) => id !== company.id),
      teamByTenant,
    };
  }
  if (selection.tenantIds.includes(company.id)) {
    return selection;
  }
  const teamId = preferredTeamId(company.teams);
  return {
    tenantIds: [...selection.tenantIds, company.id],
    teamByTenant: teamId
      ? { ...selection.teamByTenant, [company.id]: teamId }
      : { ...selection.teamByTenant },
  };
}

export function selectDepartment(
  selection: CreateAccessSelection,
  tenantId: string,
  teamId: string,
): CreateAccessSelection {
  return {
    tenantIds: selection.tenantIds,
    teamByTenant: { ...selection.teamByTenant, [tenantId]: teamId },
  };
}

export function createAccessFormError(input: {
  name: string;
  password: string;
  selection: CreateAccessSelection;
  companies: OwnedCompanyOption[];
}): string | null {
  if (input.name.trim().length < 2) {
    return 'O nome precisa ter pelo menos 2 caracteres.';
  }
  if (input.password.length < 8) {
    return 'A senha precisa ter pelo menos 8 caracteres.';
  }
  if (input.selection.tenantIds.length === 0) {
    return 'Escolha ao menos uma empresa.';
  }
  for (const tenantId of input.selection.tenantIds) {
    if (!input.selection.teamByTenant[tenantId]) {
      const company = input.companies.find((item) => item.id === tenantId);
      return `Escolha o departamento de ${company?.name ?? 'empresa'}.`;
    }
  }
  return null;
}

export function toCreateAccessBody(input: {
  name: string;
  phone: string;
  email: string;
  password: string;
  selection: CreateAccessSelection;
}): {
  name: string;
  phone: string;
  email: string;
  password: string;
  companies: Array<{ tenantId: string; teamId: string }>;
} {
  return {
    name: input.name.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    password: input.password,
    companies: input.selection.tenantIds.map((tenantId) => ({
      tenantId,
      teamId: input.selection.teamByTenant[tenantId] ?? '',
    })),
  };
}
```

`department-groups.ts`:

```ts
export function membersOfTeam<T extends { team: { id: string } | null }>(
  members: T[],
  teamId: string,
): T[] {
  return members.filter((member) => member.team?.id === teamId);
}

export function unassignedMembers<T extends { team: { id: string } | null }>(
  members: T[],
  activeTeamIds: ReadonlySet<string>,
): T[] {
  return members.filter(
    (member) => member.team === null || !activeTeamIds.has(member.team.id),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd apps/web test -- src/features/access`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/access
git commit -m "feat: define access screen rules"
```

---

### Task 6: Telas de acessos e departamentos

**Files:**
- Create: `apps/web/src/features/access/api.ts`
- Create: `apps/web/src/features/access/owner-only.tsx`
- Create: `apps/web/src/features/access/access-page.tsx`
- Create: `apps/web/src/features/access/create-access-page.tsx`
- Create: `apps/web/src/features/access/departments-page.tsx`
- Create: `apps/web/src/features/access/sidebar-links.test.ts`
- Create: `apps/web/src/routes/_authenticated/acessos/index.tsx`
- Create: `apps/web/src/routes/_authenticated/acessos/novo.tsx`
- Create: `apps/web/src/routes/_authenticated/departamentos.tsx`
- Modify: `apps/web/src/features/auth/app-sidebar.tsx`
- Modify: `apps/web/src/features/auth/authenticated-layout.tsx`
- Generated: `apps/web/src/routeTree.gen.ts`

**Interfaces:**
- Consumes: `getApi()` de `apps/web/src/api/client.ts`; `roleLabel`, `accessErrorMessage`, o formulário da Task 5, `membersOfTeam`, `unassignedMembers`; `Card`, `Button`, `Field`, `Input`, `Checkbox`, `Select`, `Dialog`, `AlertDialog`, `Item`, `Badge`, `Tabs`, `Empty`, `Skeleton`; `SidebarMenuButton` e `Link` como em `app-sidebar.tsx`.
- Produces: rotas `/acessos`, `/acessos/novo` e `/departamentos`. Funções `listMembersRequest`, `inviteMemberRequest`, `removeMemberRequest`, `listOwnedCompaniesRequest`, `createMemberRequest`, `listTeamsRequest`, `assignTeamRequest`. Componente `OwnerOnly`.

- [ ] **Step 1: Write the failing test**

Crie `apps/web/src/features/access/sidebar-links.test.ts`. O Vitest da web roda em `node`, no mesmo estilo de `schema-fields.test.ts`: o teste lê o fonte e falha enquanto a sidebar não cita as rotas.

```ts
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));

describe('access navigation', () => {
  it('adds owner links beside the existing panel item', () => {
    const sidebar = readFileSync(resolve(dir, '../auth/app-sidebar.tsx'), 'utf8');
    const layout = readFileSync(
      resolve(dir, '../auth/authenticated-layout.tsx'),
      'utf8',
    );

    expect(sidebar).toContain('to="/acessos"');
    expect(sidebar).toContain('to="/departamentos"');
    expect(sidebar).toContain('showAccess');
    expect(layout).toContain("showAccess={auth.role === 'OWNER'}");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd apps/web test -- src/features/access/sidebar-links.test.ts`

Expected: FAIL because `app-sidebar.tsx` ainda não contém `to="/acessos"`.

- [ ] **Step 3: Write minimal implementation**

`api.ts` usa `getApi()` e o formato de erro de `toAuthRequestError` em `features/auth/api.ts`: `error.value.error`. Classe `AccessRequestError` com `code`. `accessErrorCode(error)` devolve o código ou `UNKNOWN`.

Chamadas treaty, que espelham os paths:

- `getApi().companies.members.get()`
- `getApi().companies.members.invite.post({ email })`
- `getApi().companies.members.post(body)`
- `getApi().companies.members({ userId }).delete()`
- `getApi().companies.owned.get()`
- `getApi().teams.get()`
- `getApi().companies.members({ userId }).team.put({ teamId })`

Cada função confere o JSON e lança `AccessRequestError('INVALID_RESPONSE', 'A API devolveu uma resposta incompleta.')` quando faltar campo. `CompanyMember` tem `userId`, `name`, `email`, `phone`, `role` e `team` nulo ou `{ id, name, slug }`. `OwnedCompany` tem `id`, `slug`, `name` e `teams`. `TeamSummary` tem os campos que `GET /teams` já devolve: `id`, `slug`, `name`, `description`, `isActive`, `memberCount`, `leaderCount`, `permissionKeys`.

`owner-only.tsx` renderiza `Empty` com título `Acesso do proprietário` e descrição `Só o proprietário da empresa ativa gerencia acessos e departamentos.`

`access-page.tsx` lê `getRouteApi('/_authenticated')`. Sem `auth.tenant` ou com `auth.role` diferente de `OWNER`, renderiza `OwnerOnly` e não dispara query. Com dono, `useQuery` em `['company-members', tenant.id]` chama `listMembersRequest`. O cartão usa título `Acessos` e descrição `Pessoas que podem entrar nesta empresa.` Botões `Convidar` e `Criar acesso`. O segundo é `Button asChild` com `Link to="/acessos/novo"`.

`InviteDialog` e `MemberRow` são funções do módulo, irmãs de `AccessPage`. O dialog usa `Dialog`, campo `inviteEmail` do tipo `email`, e o texto `A pessoa precisa já ter uma conta.` Sucesso limpa o campo, fecha e invalida `['company-members']`. Falha mostra `FieldError` com `accessErrorMessage`.

Cada pessoa é um `Item variant="outline"` com nome, e-mail, `Badge` do `roleLabel` e botão `Remover`. O `AlertDialog` diz `Remover desta empresa` e `{nome} perde o acesso aos dados desta empresa. A conta continua e o acesso às outras empresas não muda.` `AlertDialogCancel` é `Cancelar`. O botão `Remover` é `Button variant="destructive"` e chama `removeMemberRequest`. Erro fica no dialog com `role="alert"`. Sucesso invalida a lista. Enquanto carrega, `Skeleton` com `h-16 w-full`. Lista vazia: `Nenhuma pessoa` / `Ninguém tem acesso a esta empresa.`

`create-access-page.tsx` usa a mesma trava `OwnerOnly`. A query `['owned-companies', tenant.id]` chama `listOwnedCompaniesRequest`. O formulário só monta quando `data` chegou, com `useState(() => initialCreateAccessSelection(companies, tenant.id))`. Campos nome, telefone, e-mail e senha, em `Field`, um embaixo do outro. Caixas `Checkbox` das empresas. Empresa marcada ganha `Select` com rótulo `Departamento em {nome}`. O erro de `createAccessFormError` aparece antes do pedido. O pedido usa `toCreateAccessBody`. Sucesso invalida `['company-members']` e `navigate({ to: '/acessos' })`. Falha da API usa `accessErrorMessage`. Link `Voltar` para `/acessos`. Botão `Criar acesso`, texto `Aguarde…` enquanto `pending`.

`departments-page.tsx` busca membros e `listTeamsRequest` (`['company-teams', tenant.id]`). Departamentos ativos são `items.filter((team) => team.isActive)`. `Tabs` começa no primeiro departamento ativo. `TabsList` usa `className` com `h-auto w-full justify-start overflow-x-auto`. Cada `TabsTrigger` mostra `team.name`. A aba `Sem departamento`, valor `none`, só aparece quando `unassignedMembers` não está vazio. O conteúdo usa `membersOfTeam` ou `unassignedMembers`. Cada linha tem nome, e-mail e `Select` `Departamento`. Trocar chama `assignTeamRequest` e invalida as duas queries. O valor do select continua `member.team?.id` vindo da query. Durante o pedido daquela pessoa, o select fica `disabled`. Erro em `role="alert"`. Sem departamento ativo e sem pessoas soltas: `Nenhum departamento` / `Esta empresa ainda não tem um departamento ativo.` Título do cartão: `Departamentos`. Descrição: `Quem está em cada departamento desta empresa.`

Rotas finas, no estilo de `apps/web/src/routes/_authenticated/index.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { AccessPage } from '../../../features/access/access-page';

export const Route = createFileRoute('/_authenticated/acessos/')({
  component: AccessPage,
});
```

`acessos/novo.tsx` usa `createFileRoute('/_authenticated/acessos/novo')` e `CreateAccessPage`. `departamentos.tsx` usa `createFileRoute('/_authenticated/departamentos')` e `DepartmentsPage`.

Em `app-sidebar.tsx`, importe `Building2` e `Users` de `lucide-react`. Acrescente a prop `showAccess: boolean`. Quando verdadeira, depois do item Painel, dois `SidebarMenuItem`:

```tsx
<SidebarMenuItem>
  <SidebarMenuButton asChild tooltip="Acessos">
    <Link to="/acessos">
      <Users />
      <span>Acessos</span>
    </Link>
  </SidebarMenuButton>
</SidebarMenuItem>
<SidebarMenuItem>
  <SidebarMenuButton asChild tooltip="Departamentos">
    <Link to="/departamentos">
      <Building2 />
      <span>Departamentos</span>
    </Link>
  </SidebarMenuButton>
</SidebarMenuItem>
```

Em `authenticated-layout.tsx`, passe `showAccess={auth.role === 'OWNER'}`. O restante do layout permanece.

- [ ] **Step 4: Run test to verify it passes**

O script `build` da web roda `tsc` antes do Vite, e o Vite é quem reescreve `routeTree.gen.ts`. Primeiro, no diretório `apps/web`:

```bash
bunx vite build
```

Expected: o build gera `src/routeTree.gen.ts` com `/acessos`, `/acessos/novo` e `/departamentos`.

Depois:

```bash
bun run --cwd apps/web test
bun run --cwd apps/web build
```

Expected: PASS nos testes e o `tsc` aceita os `Link` novos. Não edite `routeTree.gen.ts` à mão.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/access apps/web/src/features/auth/app-sidebar.tsx apps/web/src/features/auth/authenticated-layout.tsx apps/web/src/routes/_authenticated/acessos apps/web/src/routes/_authenticated/departamentos.tsx apps/web/src/routeTree.gen.ts
git commit -m "feat: add company access and department screens"
```

---

### Task 7: Verificação de uso

**Files:**
- Nenhum. Esta tarefa não edita código e não cria commit.

**Interfaces:**
- Consumes: as telas da Task 6, a API da Task 4 e o Postgres de `DATABASE_URL`.
- Produces: um relato do que foi visto em cada passo, no desktop e em 390px de largura.

- [ ] **Step 1: Write the failing test**

Não há teste novo. O roteiro abaixo é a verificação.

- [ ] **Step 2: Run the check**

Suba `bun run dev:api` e `bun run dev:web` se ainda não estiverem no ar. A web fica em `http://localhost:5173` e fala com a API pela proxy `/api`.

Repita o roteiro duas vezes, uma em viewport de desktop (1280×800) e outra com largura 390. Use e-mails diferentes em cada viewport, ambos em um domínio descartável, para as contas não colidirem. Em cada rodada:

1. Cadastre um proprietário pela tela `/register`, entre, e crie a primeira empresa pelo formulário que o painel já mostra.
2. Abra Acessos pela sidebar. A lista mostra o proprietário, o e-mail e o texto Proprietário.
3. Convide um e-mail que não tem conta. A tela mostra `Não há conta com este e-mail. Crie o acesso em vez de convidar.`
4. Em outra sessão, cadastre uma segunda conta. Volte ao proprietário e convide esse e-mail. A lista passa a mostrar essa pessoa como Usuário.
5. Prepare uma segunda empresa desse mesmo proprietário direto no Postgres: `Tenant` com nome `Auth Test Filial`, `Role` `OWNER`, `Membership` `ACTIVE` e um `Team` ativo chamado `Filial`. Não use `POST /auth/companies`, que recusa a segunda empresa.
6. Abra Criar acesso. A empresa ativa começa marcada. A filial também aparece, e uma empresa de outro dono não aparece. Preencha nome, telefone, e-mail e senha, deixe as duas empresas marcadas, escolha um departamento em cada uma e envie. A lista da empresa ativa mostra a pessoa nova.
7. Entre com a conta nova. O select mostra as duas empresas.
8. Abra Departamentos. A aba do departamento mostra quem foi colocado nele na criação. A pessoa convidada, sem departamento, aparece na aba Sem departamento. Mova essa pessoa para Geral. Ela passa para a aba Geral.
9. Remova a pessoa criada da empresa ativa. Ela some da lista. Entre de novo com a conta dela: o select ainda mostra a filial e não mostra a empresa da qual ela foi removida. A conta continua entrando.

No viewport de 390px, além do roteiro, confirme que o formulário de criar acesso fica numa coluna, que as abas de departamentos rolam na horizontal e que o diálogo de remover cabe na tela.

Se um passo falhar, pare e relate o passo, o que a tela mostrou e o status da API. Não altere código nesta tarefa.

- [ ] **Step 3: Commit**

Não há commit. A tarefa termina no relato.
