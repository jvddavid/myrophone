# Login, conta e empresa ativa — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entrar só com e-mail e senha, abrir a sessão da pessoa mesmo sem empresa, e trocar a empresa ativa no select da sidebar.

**Architecture:** A sessão continua uma linha em `Session`, com `tenantId` opcional. O access token omite `tenantId` quando não há empresa. Criar a primeira empresa e trocar de empresa atualizam essa mesma sessão, emitem outro access token e devolvem o refresh token que o cliente enviou, porque o banco só guarda o hash. A sidebar lê `companies` do perfil e o conteúdo principal cria a empresa quando `tenant` é nulo.

**Tech Stack:** Bun, Elysia, Prisma 7, PostgreSQL, Vitest, React, TanStack Router, sidebar e select já existentes em `apps/web`.

**Spec:** `docs/superpowers/specs/2026-11-23-login-empresa-design.md`

## Global Constraints

- Cadastro pede nome, telefone, e-mail, senha e confirmação. As duas senhas precisam ser iguais e ter no mínimo 8 caracteres. A confirmação não vai para a API.
- Nome: obrigatório, no mínimo 2 caracteres.
- Telefone: obrigatório, de 8 a 20 caracteres, depois de remover espaços nas pontas. Pode conter dígitos e os separadores `+`, espaço, `(`, `)`, `-`.
- E-mail: obrigatório, único, guardado em minúsculas.
- Login recebe só e-mail e senha.
- Sem empresa ativa, a sessão fica sem empresa. Com empresa, entra na última gravada se o vínculo estiver ativo; senão, na ativa mais antiga (`Membership.createdAt` crescente).
- Quem não tem empresa cria a primeira e vira `OWNER`. Quem já tem uma não cria outra: `COMPANY_CREATE_UNAVAILABLE` (`403`).
- Troca só aceita vínculo `ACTIVE`. Empresa inexistente ou sem vínculo responde `MEMBERSHIP_NOT_ACTIVE` (`403`).
- `POST /auth/companies` recebe `name` e `refreshToken`. `POST /auth/tenant` recebe `tenantId` e `refreshToken`. Os dois conferem o hash, mantêm a sessão e devolvem access token novo com o mesmo refresh token.
- Rotas que exigem empresa respondem `NO_ACTIVE_TENANT` (`403`) quando a sessão não tem empresa.
- Senhas diferentes na tela: "As senhas não coincidem."
- `emailVerifiedAt` e `avatarUrl` existem e ficam vazios. Não há envio de e-mail, upload, convite nem segunda empresa.
- Conta antiga, se existir: `name` recebe a parte local do e-mail e `phone` fica `00000000`.
- Os testes de fluxo usam o Postgres de `DATABASE_URL` e só apagam usuários `@auth-test.local` e empresas cujo nome começa com `Auth Test`.

---

### Task 1: Campos da conta e sessão sem empresa

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Test: `apps/api/src/modules/auth/schema-fields.test.ts`

**Interfaces:**
- Consumes: o schema atual de `User` e `Session`.
- Produces: `User.name` obrigatório, `User.phone`, `User.avatarUrl`, `User.emailVerifiedAt`, `User.lastTenantId` opcional com `onDelete: SetNull`, `Session.tenantId` opcional com `onDelete: SetNull`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/auth/schema-fields.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../prisma/schema.prisma'),
  'utf8',
);

function block(model: string, nextModel: string): string {
  const start = schema.indexOf(`model ${model} {`);
  const end = schema.indexOf(`model ${nextModel} {`);
  return schema.slice(start, end);
}

describe('account schema', () => {
  it('stores the account fields used after email and password registration', () => {
    const user = block('User', 'Permission');

    expect(user).toMatch(/name\s+String\n/);
    expect(user).not.toMatch(/name\s+String\?/);
    expect(user).toMatch(/phone\s+String\s+@default\("00000000"\)/);
    expect(user).toMatch(/avatarUrl\s+String\?/);
    expect(user).toMatch(/emailVerifiedAt\s+DateTime\?/);
    expect(user).toMatch(/lastTenantId\s+String\?/);
    expect(user).toContain('@relation("UserLastTenant"');
  });

  it('allows a session without a company', () => {
    const session = block('Session', 'ActionLog');

    expect(session).toMatch(/tenantId\s+String\?/);
    expect(session).toMatch(/onDelete:\s*SetNull/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd apps/api test -- src/modules/auth/schema-fields.test.ts`

Expected: FAIL because `phone` and `tenantId String?` are absent.

- [ ] **Step 3: Write minimal implementation**

In `apps/api/prisma/schema.prisma`, add the back-relation on `Tenant`, before `roles`:

```prisma
  lastSelectedBy User[]       @relation("UserLastTenant")
```

Replace the `User` model with:

```prisma
model User {
  id              String       @id @default(cuid())
  email           String       @unique
  name            String
  phone           String       @default("00000000")
  avatarUrl       String?
  emailVerifiedAt DateTime?
  passwordHash    String
  isActive        Boolean      @default(true)
  lastTenantId    String?
  lastTenant      Tenant?      @relation("UserLastTenant", fields: [lastTenantId], references: [id], onDelete: SetNull)
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  memberships     Membership[]
  sessions        Session[]
  actionLogs      ActionLog[]  @relation("ActorActionLogs")

  @@index([lastTenantId])
}
```

In `Session`, change the tenant fields to:

```prisma
  tenantId         String?
  tenant           Tenant?   @relation(fields: [tenantId], references: [id], onDelete: SetNull)
```

Keep the existing `@@index([tenantId])`.

Backfill existing names, then push and generate:

```bash
bun run --cwd apps/api prisma:db:push
```

If the push refuses null names, run this SQL against `DATABASE_URL` and push again:

```sql
UPDATE "User" SET "name" = split_part("email", '@', 1) WHERE "name" IS NULL OR btrim("name") = '';
```

Then:

```bash
bun run --cwd apps/api prisma:generate
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd apps/api test -- src/modules/auth/schema-fields.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/src/modules/auth/schema-fields.test.ts
git commit -m "feat: store account profile and optional session company"
```

---

### Task 2: Validação do telefone

**Files:**
- Create: `apps/api/src/modules/auth/phone.ts`
- Test: `apps/api/src/modules/auth/phone.test.ts`

**Interfaces:**
- Consumes: `AppError` de `apps/api/src/core/errors/app-error.ts`.
- Produces: `normalizePhone(value: string): string`. Lança `AppError` `400` `VALIDATION_ERROR` quando o telefone é inválido. Devolve o texto sem espaços nas pontas.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/auth/phone.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AppError } from '../../core/errors/app-error';
import { normalizePhone } from './phone';

describe('normalizePhone', () => {
  it('trims a phone made of digits and allowed separators', () => {
    expect(normalizePhone(' (11) 98765-4321 ')).toBe('(11) 98765-4321');
  });

  it('rejects a phone outside 8 to 20 characters', () => {
    expect(() => normalizePhone('1234567')).toThrow(AppError);
  });

  it('rejects a phone with letters', () => {
    try {
      normalizePhone('telefone!!');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('VALIDATION_ERROR');
      expect((error as AppError).statusCode).toBe(400);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd apps/api test -- src/modules/auth/phone.test.ts`

Expected: FAIL with "Cannot find module './phone'".

- [ ] **Step 3: Write minimal implementation**

Create `apps/api/src/modules/auth/phone.ts`:

```ts
import { AppError } from '../../core/errors/app-error';

const phonePattern = /^[0-9+()\- ]+$/;

export function normalizePhone(value: string): string {
  const phone = value.trim();

  if (phone.length < 8 || phone.length > 20 || !phonePattern.test(phone)) {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Phone number is invalid.',
    });
  }

  return phone;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd apps/api test -- src/modules/auth/phone.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/phone.ts apps/api/src/modules/auth/phone.test.ts
git commit -m "feat: validate account phone numbers"
```

---

### Task 3: Escolha da empresa ativa e sufixo do identificador

**Files:**
- Create: `apps/api/src/modules/auth/company-selection.ts`
- Test: `apps/api/src/modules/auth/company-selection.test.ts`

**Interfaces:**
- Consumes: nada das tasks anteriores.
- Produces:
  - `chooseActiveTenantId(memberships: Array<{ tenantId: string; createdAt: Date; status: string }>, lastTenantId: string | null): string | null`
  - `withSlugSuffix(base: string, attempt: number): string` — `attempt` 1 devolve `base`; attempt 2 devolve `base-2`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/auth/company-selection.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { chooseActiveTenantId, withSlugSuffix } from './company-selection';

const older = new Date('2020-01-01T00:00:00.000Z');
const newer = new Date('2024-01-01T00:00:00.000Z');

describe('chooseActiveTenantId', () => {
  it('returns null when the account has no active company', () => {
    expect(
      chooseActiveTenantId(
        [{ tenantId: 'a', createdAt: older, status: 'SUSPENDED' }],
        'a',
      ),
    ).toBeNull();
  });

  it('returns the oldest active company when none was saved', () => {
    expect(
      chooseActiveTenantId(
        [
          { tenantId: 'new', createdAt: newer, status: 'ACTIVE' },
          { tenantId: 'old', createdAt: older, status: 'ACTIVE' },
        ],
        null,
      ),
    ).toBe('old');
  });

  it('returns the saved company when that membership is still active', () => {
    expect(
      chooseActiveTenantId(
        [
          { tenantId: 'old', createdAt: older, status: 'ACTIVE' },
          { tenantId: 'saved', createdAt: newer, status: 'ACTIVE' },
        ],
        'saved',
      ),
    ).toBe('saved');
  });

  it('falls back to the oldest active company when the saved one is inactive', () => {
    expect(
      chooseActiveTenantId(
        [
          { tenantId: 'saved', createdAt: newer, status: 'SUSPENDED' },
          { tenantId: 'old', createdAt: older, status: 'ACTIVE' },
        ],
        'saved',
      ),
    ).toBe('old');
  });
});

describe('withSlugSuffix', () => {
  it('keeps the first slug and suffixes the later attempts', () => {
    expect(withSlugSuffix('acme', 1)).toBe('acme');
    expect(withSlugSuffix('acme', 2)).toBe('acme-2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd apps/api test -- src/modules/auth/company-selection.test.ts`

Expected: FAIL with "Cannot find module './company-selection'".

- [ ] **Step 3: Write minimal implementation**

Create `apps/api/src/modules/auth/company-selection.ts`:

```ts
export interface CompanyMembershipChoice {
  tenantId: string;
  createdAt: Date;
  status: string;
}

export function chooseActiveTenantId(
  memberships: CompanyMembershipChoice[],
  lastTenantId: string | null,
): string | null {
  const active = memberships
    .filter((membership) => membership.status === 'ACTIVE')
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());

  if (active.length === 0) {
    return null;
  }

  const saved = active.find((membership) => membership.tenantId === lastTenantId);
  return (saved ?? active[0]).tenantId;
}

export function withSlugSuffix(base: string, attempt: number): string {
  if (attempt <= 1) {
    return base;
  }

  return `${base}-${attempt}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd apps/api test -- src/modules/auth/company-selection.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/company-selection.ts apps/api/src/modules/auth/company-selection.test.ts
git commit -m "feat: choose the active company for a login"
```

---

### Task 4: Access token sem empresa

**Files:**
- Modify: `apps/api/src/modules/auth/token.ts`
- Test: `apps/api/src/modules/auth/token.test.ts`

**Interfaces:**
- Consumes: `signAccessToken` e `verifyAccessToken` atuais. `tenantId` hoje é `string`.
- Produces: `signAccessToken({ userId, sessionId, tenantId: string | null, email })`. `verifyAccessToken` devolve `tenantId: string | null`. Token sem empresa não contém a claim `tenantId`. Token com empresa continua igual.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/auth/token.test.ts`:

```ts
import { decodeJwt } from 'jose';
import { describe, expect, it } from 'vitest';
import { signAccessToken, verifyAccessToken } from './token';

describe('access token company claim', () => {
  it('omits tenantId when the session has no company', async () => {
    const token = await signAccessToken({
      userId: 'user-1',
      sessionId: 'session-1',
      tenantId: null,
      email: 'ana@auth-test.local',
    });
    const claims = decodeJwt(token);
    const verified = await verifyAccessToken(token);

    expect(claims.tenantId).toBeUndefined();
    expect(verified).toMatchObject({
      sub: 'user-1',
      sid: 'session-1',
      tenantId: null,
      email: 'ana@auth-test.local',
    });
  });

  it('keeps tenantId when the session has a company', async () => {
    const token = await signAccessToken({
      userId: 'user-1',
      sessionId: 'session-1',
      tenantId: 'tenant-1',
      email: 'ana@auth-test.local',
    });
    const verified = await verifyAccessToken(token);

    expect(verified?.tenantId).toBe('tenant-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd apps/api test -- src/modules/auth/token.test.ts`

Expected: FAIL because `tenantId: null` does not type-check or the claim is still required.

- [ ] **Step 3: Write minimal implementation**

In `apps/api/src/modules/auth/token.ts`, change the payload types:

```ts
export interface AccessTokenPayload {
  sub: string;
  sid: string;
  tenantId: string | null;
  email: string;
  exp?: number;
  iat?: number;
}

export async function signAccessToken(payload: {
  userId: string;
  sessionId: string;
  tenantId: string | null;
  email: string;
}): Promise<string> {
  const claims: Record<string, string> = {
    sid: payload.sessionId,
    email: payload.email,
  };

  if (payload.tenantId) {
    claims.tenantId = payload.tenantId;
  }

  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_TTL)
    .sign(secret);
}
```

In `verifyAccessToken`, accept a missing claim:

```ts
    const tenantId = claimBag.tenantId ?? null;

    if (
      typeof sub !== 'string' ||
      typeof sid !== 'string' ||
      (tenantId !== null && typeof tenantId !== 'string') ||
      typeof email !== 'string'
    ) {
      return null;
    }
```

Return that `tenantId` in the payload object.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd apps/api test -- src/modules/auth/token.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/token.ts apps/api/src/modules/auth/token.test.ts
git commit -m "feat: issue access tokens without a company"
```

---

### Task 5: Cadastro da conta e sessão sem empresa

**Files:**
- Modify: `apps/api/src/modules/auth/db-types.ts` (`UserRecord`, `SessionRecord`)
- Modify: `apps/api/src/modules/auth/service.ts`
- Modify: `apps/api/src/modules/auth/http/auth.routes.ts`
- Create: `apps/api/src/modules/auth/http/auth-flow-client.ts`
- Test: `apps/api/src/modules/auth/http/register.flow.test.ts`

**Interfaces:**
- Consumes: `normalizePhone`, `signAccessToken` com `tenantId: string | null`, schema da Task 1.
- Produces:
  - `registerAccount(input: { name: string; phone: string; email: string; password: string }, requestMeta): Promise<AuthResponse>`
  - `AuthContext.membershipId: string | null`
  - `AuthContext.tenant: { id: string; slug: string; name: string } | null`
  - `AuthContext.role: string | null`
  - `AuthContext.companies: Array<{ id: string; slug: string; name: string }>`
  - `AuthContext.user` inclui `phone: string`, `avatarUrl: string | null`, `emailVerifiedAt: string | null`
  - `POST /auth/register` recebe `{ name, phone, email, password }` e responde `201` sem empresa.
  - `GET /auth/me` e `POST /auth/refresh` devolvem esse perfil para a sessão sem empresa.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/auth/http/auth-flow-client.ts`:

```ts
import { app } from '../../../app';
import { getPrisma } from '../../../core/db/prisma';

export async function postAuth(
  path: string,
  body: unknown,
  accessToken?: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };

  if (accessToken) {
    headers.authorization = `Bearer ${accessToken}`;
  }

  const response = await app.handle(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }),
  );

  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

export async function getAuth(
  path: string,
  accessToken: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await app.handle(
    new Request(`http://localhost${path}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    }),
  );

  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

export async function cleanupAuthTests(): Promise<void> {
  const prisma = await getPrisma();
  const users = (await prisma.user.findMany({
    where: { email: { endsWith: '@auth-test.local' } },
    select: { id: true },
  })) as Array<{ id: string }>;
  const userIds = users.map((user) => user.id);

  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.membership.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.tenant.deleteMany({
    where: { name: { startsWith: 'Auth Test' } },
  });
}
```

Create `apps/api/src/modules/auth/http/register.flow.test.ts`:

```ts
import { afterAll, describe, expect, it } from 'vitest';
import { getPrisma } from '../../../core/db/prisma';
import { cleanupAuthTests, getAuth, postAuth } from './auth-flow-client';

const email = `register-${crypto.randomUUID()}@auth-test.local`;
const password = 'senha-forte';

afterAll(async () => {
  await cleanupAuthTests();
});

describe('POST /auth/register', () => {
  it('creates an account session without a company', async () => {
    const created = await postAuth('/auth/register', {
      name: 'Ana Teste',
      phone: '(11) 98765-4321',
      email,
      password,
    });
    const tokens = created.body.tokens as { accessToken: string; refreshToken: string };
    const profile = await getAuth('/auth/me', tokens.accessToken);
    const refreshed = await postAuth('/auth/refresh', {
      refreshToken: tokens.refreshToken,
    });
    const prisma = await getPrisma();
    const memberships = (await prisma.membership.findMany({
      where: { user: { email } },
    })) as unknown[];

    expect(created.status).toBe(201);
    expect(created.body.tenant).toBeNull();
    expect(created.body.membershipId).toBeNull();
    expect(created.body.role).toBeNull();
    expect(created.body.companies).toEqual([]);
    expect(created.body.user).toMatchObject({
      email,
      name: 'Ana Teste',
      phone: '(11) 98765-4321',
      avatarUrl: null,
      emailVerifiedAt: null,
    });
    expect(profile.status).toBe(200);
    expect(profile.body.tenant).toBeNull();
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.tenant).toBeNull();
    expect(memberships).toHaveLength(0);
  });

  it('rejects a duplicate email and an invalid phone', async () => {
    const duplicate = await postAuth('/auth/register', {
      name: 'Ana Teste',
      phone: '11987654321',
      email,
      password,
    });
    const phone = await postAuth('/auth/register', {
      name: 'Ana Teste',
      phone: 'telefone!!',
      email: `phone-${crypto.randomUUID()}@auth-test.local`,
      password,
    });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error).toBe('EMAIL_IN_USE');
    expect(phone.status).toBe(400);
    expect(phone.body.error).toBe('VALIDATION_ERROR');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd apps/api test -- src/modules/auth/http/register.flow.test.ts`

Expected: FAIL with `404` or `422` because `/auth/register` still requires `tenantName`.

- [ ] **Step 3: Write minimal implementation**

Update `UserRecord` in `db-types.ts`:

```ts
export interface UserRecord {
  id: string;
  email: string;
  name: string;
  phone: string;
  avatarUrl: string | null;
  emailVerifiedAt: Date | null;
  passwordHash: string;
  isActive: boolean;
  lastTenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

Change `SessionRecord.tenantId` to `string | null`.

Replace `AuthContext` in `service.ts` so `membershipId` and `role` are `string | null`, `tenant` is nullable, `companies` is the company list, and `user` includes `phone`, `avatarUrl`, and `emailVerifiedAt: string | null`.

Add these helpers next to `toAuthContext`:

```ts
interface CompanySummary {
  id: string;
  slug: string;
  name: string;
}

function toPublicUser(user: UserRecord) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    isActive: user.isActive,
  };
}

async function listActiveCompanies(
  db: PrismaDb,
  userId: string,
): Promise<CompanySummary[]> {
  const memberships = asType<
    Array<{ tenant: { id: string; slug: string; name: string } }>
  >(
    await db.membership.findMany({
      where: { userId, status: MEMBERSHIP_ACTIVE },
      include: { tenant: true },
    }),
  );

  return memberships
    .map((membership) => membership.tenant)
    .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
}

function toAccountContext(
  user: UserRecord,
  sessionId: string,
  companies: CompanySummary[],
): AuthContext {
  return {
    sessionId,
    membershipId: null,
    user: toPublicUser(user),
    tenant: null,
    companies,
    role: null,
    permissions: [],
    teams: [],
    teamPermissions: [],
  };
}
```

`toAuthContext` must also fill `companies` from a new argument `companies: CompanySummary[]` and use `toPublicUser`. Update `toAuthResponse` to pass companies. Every current caller that has a membership loads companies with `listActiveCompanies(db, membership.userId)` before building the response.

Add `createAccountSessionTokens(db, user, requestMeta)` that creates `Session` with `tenantId: null` and signs an access token with `tenantId: null`.

Export `registerAccount`. It validates password length with the existing `INVALID_PASSWORD` error, calls `normalizePhone`, normalizes the email, rejects `EMAIL_IN_USE`, creates the user with `avatarUrl: null` and `emailVerifiedAt: null`, opens an account session, writes an action log with `tenantId: null`, action `auth.register`, and returns `toAccountContext` plus tokens. Do not create `Tenant` or `Membership`.

In `refreshAuthSession`, when `currentSession.tenantId` is null, load the user, revoke the current session, call `createAccountSessionTokens`, and return the account profile with `listActiveCompanies`. When `tenantId` is present, keep the current membership refresh.

`createActionLog` accepts `tenantId?: string`. Pass `session.tenantId ?? undefined` from logout and from account registration so a null company does not become a type error.

In `resolveAuthContextFromRequest`, compare tenant ids with `session.tenantId !== payload.tenantId`, which is false when both are null. If both are null, skip `findActiveMembership` and return `toAccountContext` when the user is active. If the token has a tenant, keep the membership lookup.

In `auth.routes.ts`, replace the register schema and handler:

```ts
const registerBodySchema = t.Object({
  name: t.String({ minLength: 2 }),
  phone: t.String({ minLength: 8, maxLength: 20 }),
  email: t.String({ format: 'email' }),
  password: t.String({ minLength: 8 }),
});
```

Call `registerAccount` instead of `registerTenantOwner`. Leave `registerTenantOwner` in the file until Task 7 moves its company bootstrap into `createFirstCompany`; no route may call it after this task.

`ensureTeamMemberManagement` must reject a null role before calling `isTenantAdminRole`:

```ts
  if (!authContext.role || !authContext.tenant) {
    throw new AppError({
      statusCode: 403,
      code: 'NO_ACTIVE_TENANT',
      message: 'An active company is required.',
    });
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd apps/api test -- src/modules/auth/http/register.flow.test.ts`

Expected: PASS. Then run `bun run --cwd apps/api check` and fix type errors caused by the nullable tenant in this task's files.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/db-types.ts apps/api/src/modules/auth/service.ts apps/api/src/modules/auth/http/auth.routes.ts apps/api/src/modules/auth/http/auth-flow-client.ts apps/api/src/modules/auth/http/register.flow.test.ts
git commit -m "feat: register an account before any company"
```

---

### Task 6: Login escolhe a empresa

**Files:**
- Modify: `apps/api/src/modules/auth/service.ts` (`loginWithPassword`)
- Modify: `apps/api/src/modules/auth/http/auth.routes.ts` (login body)
- Test: `apps/api/src/modules/auth/http/login.flow.test.ts`

**Interfaces:**
- Consumes: `registerAccount`, `chooseActiveTenantId`, `createAccountSessionTokens`, `listActiveCompanies`.
- Produces: `loginWithPassword({ email, password })` sem `tenantSlug`. Grava `User.lastTenantId` quando escolhe uma empresa. `POST /auth/login` não aceita mais `tenantSlug`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/auth/http/login.flow.test.ts`:

```ts
import { afterAll, describe, expect, it } from 'vitest';
import { getPrisma } from '../../../core/db/prisma';
import { asType } from '../db-types';
import { cleanupAuthTests, postAuth } from './auth-flow-client';

const password = 'senha-forte';

afterAll(async () => {
  await cleanupAuthTests();
});

async function register(email: string): Promise<void> {
  const response = await postAuth('/auth/register', {
    name: 'Ana Teste',
    phone: '11987654321',
    email,
    password,
  });

  expect(response.status).toBe(201);
}

describe('POST /auth/login', () => {
  it('logs in without a company field and keeps the account session', async () => {
    const email = `login-empty-${crypto.randomUUID()}@auth-test.local`;
    await register(email);

    const response = await postAuth('/auth/login', { email, password });

    expect(response.status).toBe(200);
    expect(response.body.tenant).toBeNull();
    expect(response.body.companies).toEqual([]);
  });

  it('uses the saved company and otherwise the oldest active company', async () => {
    const email = `login-many-${crypto.randomUUID()}@auth-test.local`;
    await register(email);
    const prisma = await getPrisma();
    const user = asType<{ id: string }>(
      await prisma.user.findUnique({ where: { email } }),
    );
    const older = asType<{ id: string }>(
      await prisma.tenant.create({
        data: { name: 'Auth Test Older', slug: `auth-test-older-${crypto.randomUUID()}` },
      }),
    );
    const newer = asType<{ id: string }>(
      await prisma.tenant.create({
        data: { name: 'Auth Test Newer', slug: `auth-test-newer-${crypto.randomUUID()}` },
      }),
    );

    for (const tenant of [
      { id: older.id, createdAt: new Date('2020-01-01T00:00:00.000Z') },
      { id: newer.id, createdAt: new Date('2024-01-01T00:00:00.000Z') },
    ]) {
      const role = asType<{ id: string }>(
        await prisma.role.create({
          data: { tenantId: tenant.id, name: 'USER', isSystem: true },
        }),
      );
      await prisma.membership.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          roleId: role.id,
          status: 'ACTIVE',
          createdAt: tenant.createdAt,
        },
      });
    }

    const firstLogin = await postAuth('/auth/login', { email, password });
    const firstTenant = firstLogin.body.tenant as { id: string };

    await prisma.user.update({
      where: { id: user.id },
      data: { lastTenantId: newer.id },
    });
    const savedLogin = await postAuth('/auth/login', { email, password });

    await prisma.membership.update({
      where: { tenantId_userId: { tenantId: newer.id, userId: user.id } },
      data: { status: 'SUSPENDED' },
    });
    const fallbackLogin = await postAuth('/auth/login', { email, password });

    expect(firstTenant.id).toBe(older.id);
    expect((savedLogin.body.tenant as { id: string }).id).toBe(newer.id);
    expect((fallbackLogin.body.tenant as { id: string }).id).toBe(older.id);
    expect(savedLogin.body.companies).toEqual([
      expect.objectContaining({ id: newer.id, name: 'Auth Test Newer' }),
      expect.objectContaining({ id: older.id, name: 'Auth Test Older' }),
    ]);
  });
});
```

The companies assertion expects nome ordenado: `Auth Test Newer` antes de `Auth Test Older` por `localeCompare` `pt-BR`. If the locale order differs, assert the ids as a set and assert each item has `id`, `slug`, and `name`.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd apps/api test -- src/modules/auth/http/login.flow.test.ts`

Expected: FAIL because login still reads `tenantSlug` and does not attach the two companies.

- [ ] **Step 3: Write minimal implementation**

Remove `tenantSlug` from `loginWithPassword` and from `loginBodySchema`.

After the password and `isActive` checks, load memberships:

```ts
  const memberships = asType<
    Array<{ tenantId: string; createdAt: Date; status: string }>
  >(
    await prisma.membership.findMany({
      where: { userId: user.id },
      select: { tenantId: true, createdAt: true, status: true },
    }),
  );
  const tenantId = chooseActiveTenantId(memberships, user.lastTenantId);
```

If `tenantId` is null, open an account session and return the account profile. Do not throw `NO_ACTIVE_TENANT` or `TENANT_REQUIRED`.

If `tenantId` is set, load the active membership, update `user.lastTenantId`, create the tenant session, write `auth.login`, and return `toAuthResponse` with `listActiveCompanies`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd apps/api test -- src/modules/auth/http/login.flow.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/service.ts apps/api/src/modules/auth/http/auth.routes.ts apps/api/src/modules/auth/http/login.flow.test.ts
git commit -m "feat: log in with email and password across companies"
```

---

### Task 7: Criar a primeira empresa

**Files:**
- Modify: `apps/api/src/modules/auth/service.ts`
- Modify: `apps/api/src/modules/auth/http/auth.routes.ts`
- Test: `apps/api/src/modules/auth/http/create-company.flow.test.ts`

**Interfaces:**
- Consumes: `requireAuthContext`, `ensureTenantRbac`, `withSlugSuffix`, `normalizeTenantSlug`, account session from Task 5.
- Produces: `createFirstCompany(input: { userId: string; sessionId: string; name: string; refreshToken: string }, requestMeta): Promise<AuthResponse>`. `POST /auth/companies`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/auth/http/create-company.flow.test.ts`:

```ts
import { afterAll, describe, expect, it } from 'vitest';
import { getPrisma } from '../../../core/db/prisma';
import { asType } from '../db-types';
import { cleanupAuthTests, getAuth, postAuth } from './auth-flow-client';

afterAll(async () => {
  await cleanupAuthTests();
});

describe('POST /auth/companies', () => {
  it('creates the first company on the same session and rejects a second one', async () => {
    const email = `company-${crypto.randomUUID()}@auth-test.local`;
    const registered = await postAuth('/auth/register', {
      name: 'Ana Teste',
      phone: '11987654321',
      email,
      password: 'senha-forte',
    });
    const tokens = registered.body.tokens as {
      accessToken: string;
      refreshToken: string;
    };

    const created = await postAuth(
      '/auth/companies',
      { name: 'Auth Test Acme', refreshToken: tokens.refreshToken },
      tokens.accessToken,
    );
    const nextTokens = created.body.tokens as {
      accessToken: string;
      refreshToken: string;
    };
    const profile = await getAuth('/auth/me', nextTokens.accessToken);
    const again = await postAuth(
      '/auth/companies',
      { name: 'Auth Test Other', refreshToken: nextTokens.refreshToken },
      nextTokens.accessToken,
    );
    const prisma = await getPrisma();
    const sessions = asType<Array<{ id: string }>>(
      await prisma.session.findMany({ where: { user: { email }, revokedAt: null } }),
    );

    expect(created.status).toBe(200);
    expect(created.body.sessionId).toBe(registered.body.sessionId);
    expect(nextTokens.refreshToken).toBe(tokens.refreshToken);
    expect(nextTokens.accessToken).not.toBe(tokens.accessToken);
    expect(created.body.role).toBe('OWNER');
    expect(created.body.tenant).toMatchObject({ name: 'Auth Test Acme' });
    expect(profile.body.tenant).toMatchObject({ name: 'Auth Test Acme' });
    expect(again.status).toBe(403);
    expect(again.body.error).toBe('COMPANY_CREATE_UNAVAILABLE');
    expect(sessions).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd apps/api test -- src/modules/auth/http/create-company.flow.test.ts`

Expected: FAIL with 404 because the route does not exist.

- [ ] **Step 3: Write minimal implementation**

Add `reissueAccessToken(sessionId, user, tenantId)` which only calls `signAccessToken` and returns the new access token plus the existing refresh expiry already stored on the session.

Add `assertCurrentRefreshToken(session, refreshToken)` which hashes the token and throws `401` `INVALID_REFRESH_TOKEN` when the hash differs, the session is revoked, or it is expired.

Export `createFirstCompany`. It loads the session by id, checks `session.userId === input.userId`, asserts the refresh token, and counts active memberships. A count above zero throws:

```ts
throw new AppError({
  statusCode: 403,
  code: 'COMPANY_CREATE_UNAVAILABLE',
  message: 'This account already has an active company.',
});
```

Otherwise, inside a transaction, pick a slug:

```ts
const base = normalizeTenantSlug(input.name);
let slug = base;

for (let attempt = 1; attempt <= 50; attempt += 1) {
  slug = withSlugSuffix(base, attempt);
  const existing = await transaction.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (!existing) {
    break;
  }
}
```

Create the tenant, call `ensureTenantRbac`, create the `OWNER` membership, the default team `geral` / `Geral`, and the leader team membership. Reuse the team permission block from `registerTenantOwner` with no initial permission keys. Update `session.tenantId` and `user.lastTenantId`. Return the membership profile, the same `sessionId`, the same refresh token string, and the new access token.

Delete `registerTenantOwner` after this move. No remaining import may reference it.

Add the route:

```ts
const createCompanyBodySchema = t.Object({
  name: t.String({ minLength: 2 }),
  refreshToken: t.String({ minLength: 10 }),
});

.post(
  '/auth/companies',
  async ({ body, request, status }) => {
    try {
      const auth = await requireAuthContext(request);
      return await createFirstCompany(
        {
          userId: auth.user.id,
          sessionId: auth.sessionId,
          name: body.name,
          refreshToken: body.refreshToken,
        },
        getRequestMeta(request),
      );
    } catch (error) {
      return toErrorResponse(error, status);
    }
  },
  { body: createCompanyBodySchema },
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd apps/api test -- src/modules/auth/http/create-company.flow.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/service.ts apps/api/src/modules/auth/http/auth.routes.ts apps/api/src/modules/auth/http/create-company.flow.test.ts
git commit -m "feat: create the first company on the current session"
```

---

### Task 8: Trocar a empresa da sessão

**Files:**
- Modify: `apps/api/src/modules/auth/service.ts`
- Modify: `apps/api/src/modules/auth/http/auth.routes.ts`
- Test: `apps/api/src/modules/auth/http/switch-company.flow.test.ts`

**Interfaces:**
- Consumes: `assertCurrentRefreshToken`, `reissueAccessToken`, `findActiveMembership`, `listActiveCompanies`.
- Produces: `switchCompany(input: { userId: string; sessionId: string; tenantId: string; refreshToken: string }, requestMeta): Promise<AuthResponse>`. `POST /auth/tenant`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/auth/http/switch-company.flow.test.ts`:

```ts
import { afterAll, describe, expect, it } from 'vitest';
import { getPrisma } from '../../../core/db/prisma';
import { asType } from '../db-types';
import { cleanupAuthTests, postAuth } from './auth-flow-client';

afterAll(async () => {
  await cleanupAuthTests();
});

describe('POST /auth/tenant', () => {
  it('switches to another active company and keeps the refresh token', async () => {
    const email = `switch-${crypto.randomUUID()}@auth-test.local`;
    const registered = await postAuth('/auth/register', {
      name: 'Ana Teste',
      phone: '11987654321',
      email,
      password: 'senha-forte',
    });
    const tokens = registered.body.tokens as {
      accessToken: string;
      refreshToken: string;
    };
    const first = await postAuth(
      '/auth/companies',
      { name: 'Auth Test One', refreshToken: tokens.refreshToken },
      tokens.accessToken,
    );
    const current = first.body.tokens as {
      accessToken: string;
      refreshToken: string;
    };
    const prisma = await getPrisma();
    const user = asType<{ id: string }>(
      await prisma.user.findUnique({ where: { email } }),
    );
    const second = asType<{ id: string }>(
      await prisma.tenant.create({
        data: {
          name: 'Auth Test Two',
          slug: `auth-test-two-${crypto.randomUUID()}`,
        },
      }),
    );
    const role = asType<{ id: string }>(
      await prisma.role.create({
        data: { tenantId: second.id, name: 'USER', isSystem: true },
      }),
    );
    await prisma.membership.create({
      data: {
        tenantId: second.id,
        userId: user.id,
        roleId: role.id,
        status: 'ACTIVE',
      },
    });

    const switched = await postAuth(
      '/auth/tenant',
      { tenantId: second.id, refreshToken: current.refreshToken },
      current.accessToken,
    );
    const switchedTokens = switched.body.tokens as {
      accessToken: string;
      refreshToken: string;
    };
    const missing = await postAuth(
      '/auth/tenant',
      { tenantId: 'missing-company', refreshToken: current.refreshToken },
      switchedTokens.accessToken,
    );

    expect(switched.status).toBe(200);
    expect(switched.body.sessionId).toBe(first.body.sessionId);
    expect(switchedTokens.refreshToken).toBe(current.refreshToken);
    expect((switched.body.tenant as { id: string }).id).toBe(second.id);
    expect(switched.body.role).toBe('USER');
    expect(missing.status).toBe(403);
    expect(missing.body.error).toBe('MEMBERSHIP_NOT_ACTIVE');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd apps/api test -- src/modules/auth/http/switch-company.flow.test.ts`

Expected: FAIL with 404.

- [ ] **Step 3: Write minimal implementation**

Export `switchCompany`. Assert the refresh token against the session. `findActiveMembership` must return status `ACTIVE`; otherwise throw the existing `MEMBERSHIP_NOT_ACTIVE` error. Update `session.tenantId` and `user.lastTenantId`. Return the new profile with the same session id, the same refresh token, and a new access token. Write action log `auth.switch_tenant`.

Add the route `POST /auth/tenant` with body `{ tenantId: t.String({ minLength: 1 }), refreshToken: t.String({ minLength: 10 }) }`, using `requireAuthContext` the same way as `/auth/companies`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd apps/api test -- src/modules/auth/http/switch-company.flow.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/service.ts apps/api/src/modules/auth/http/auth.routes.ts apps/api/src/modules/auth/http/switch-company.flow.test.ts
git commit -m "feat: switch the active company on the same session"
```

---

### Task 9: Rotas de empresa recusam sessão sem empresa

**Files:**
- Modify: `apps/api/src/modules/auth/service.ts`
- Modify: `apps/api/src/modules/jobs/http/jobs.routes.ts`
- Modify: `apps/api/src/modules/auth/http/management.routes.ts`
- Test: `apps/api/src/modules/auth/http/tenant-required.flow.test.ts`

**Interfaces:**
- Consumes: `AuthContext` com `tenant` nulo.
- Produces: `requireTenantContext(auth: AuthContext): AuthContext & { tenant: { id: string; slug: string; name: string }; membershipId: string; role: string }`. Lança `403` `NO_ACTIVE_TENANT`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/auth/http/tenant-required.flow.test.ts`:

```ts
import { afterAll, describe, expect, it } from 'vitest';
import { app } from '../../../app';
import { cleanupAuthTests, postAuth } from './auth-flow-client';

afterAll(async () => {
  await cleanupAuthTests();
});

describe('tenant-scoped routes', () => {
  it('rejects a session that has no company', async () => {
    const email = `jobs-${crypto.randomUUID()}@auth-test.local`;
    const registered = await postAuth('/auth/register', {
      name: 'Ana Teste',
      phone: '11987654321',
      email,
      password: 'senha-forte',
    });
    const token = (registered.body.tokens as { accessToken: string }).accessToken;
    const response = await app.handle(
      new Request('http://localhost/jobs/tenant-hierarchy-export', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      }),
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(403);
    expect(body.error).toBe('NO_ACTIVE_TENANT');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd apps/api test -- src/modules/auth/http/tenant-required.flow.test.ts`

Expected: FAIL because the handler reads `auth.tenant.id` and throws a 500, or returns another code.

- [ ] **Step 3: Write minimal implementation**

Add to `service.ts`:

```ts
export function requireTenantContext(auth: AuthContext): AuthContext & {
  membershipId: string;
  tenant: { id: string; slug: string; name: string };
  role: string;
} {
  if (!auth.tenant || !auth.membershipId || !auth.role) {
    throw new AppError({
      statusCode: 403,
      code: 'NO_ACTIVE_TENANT',
      message: 'An active company is required.',
    });
  }

  return auth as AuthContext & {
    membershipId: string;
    tenant: { id: string; slug: string; name: string };
    role: string;
  };
}
```

In `jobs.routes.ts`, import `requireTenantContext` and put this immediately after every `requireAuthContext(request)`:

```ts
const auth = requireTenantContext(await requireAuthContext(request));
```

Do the same in every handler of `management.routes.ts` that currently uses `auth.tenant`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd apps/api test -- src/modules/auth/http/tenant-required.flow.test.ts`

Expected: PASS. Then run `bun run --cwd apps/api test` and `bun run --cwd apps/api check`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/service.ts apps/api/src/modules/jobs/http/jobs.routes.ts apps/api/src/modules/auth/http/management.routes.ts apps/api/src/modules/auth/http/tenant-required.flow.test.ts
git commit -m "feat: reject company routes when the session has none"
```

---

### Task 10: Telas de cadastro e login

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/features/auth/register-form.ts`
- Test: `apps/web/src/features/auth/register-form.test.ts`
- Modify: `apps/web/src/features/auth/types.ts`
- Modify: `apps/web/src/features/auth/api.ts`
- Modify: `apps/web/src/features/auth/register-page.tsx`
- Modify: `apps/web/src/features/auth/login-page.tsx`

**Interfaces:**
- Consumes: `POST /auth/register` e `POST /auth/login` das tasks 5 e 6. O cliente Eden está em `getApi()`.
- Produces:
  - `registerPasswordError(password: string, confirmPassword: string): string | null`
  - `AuthProfile.tenant` nulo ou empresa, `companies`, `membershipId` e `role` nulos, `user.phone`, `user.avatarUrl`, `user.emailVerifiedAt`
  - `registerRequest({ name, phone, email, password })`
  - `loginRequest({ email, password })`

- [ ] **Step 1: Write the failing test**

Add Vitest to the web app:

```bash
bun add -d vitest --cwd apps/web
```

Add `"test": "vitest run"` to `apps/web/package.json` scripts.

Create `apps/web/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
```

Create `apps/web/src/features/auth/register-form.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { registerPasswordError } from './register-form';

describe('registerPasswordError', () => {
  it('asks for both passwords to match', () => {
    expect(registerPasswordError('senha-forte', 'outra-senha')).toBe(
      'As senhas não coincidem.',
    );
  });

  it('accepts two equal passwords', () => {
    expect(registerPasswordError('senha-forte', 'senha-forte')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd apps/web test -- src/features/auth/register-form.test.ts`

Expected: FAIL with "Cannot find module './register-form'".

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/features/auth/register-form.ts`:

```ts
export function registerPasswordError(
  password: string,
  confirmPassword: string,
): string | null {
  if (password !== confirmPassword) {
    return 'As senhas não coincidem.';
  }

  return null;
}
```

Update `AuthProfile` in `types.ts` to the API shape: nullable `membershipId`, `tenant`, and `role`; `companies: Array<{ id: string; slug: string; name: string }>`; user fields `phone`, `avatarUrl`, and `emailVerifiedAt`. Add messages:

```ts
  COMPANY_CREATE_UNAVAILABLE: 'Esta conta já tem uma empresa.',
  INVALID_REFRESH_TOKEN: 'Sua sessão expirou. Entre de novo.',
```

Remove `TENANT_REQUIRED` usage from the login form. Keep the message map entry only if some response can still send it; the login API no longer does.

Change `registerRequest` to post `{ name, phone, email, password }`. Change `loginRequest` to post only `{ email, password }`. Extend `isAuthProfile` so `tenant === null` is valid, `companies` is an array of `{ id, slug, name }`, and the new user fields are present. `membershipId` and `role` may be `null`.

In `register-page.tsx`, remove `tenantName`. Fields: nome, telefone, e-mail, senha, confirmação. Title `Criar conta`. Description `Crie a conta para entrar no painel.` Use `registerPasswordError` before the request. Phone input `type="tel"` `autoComplete="tel"` `minLength={8}` `maxLength={20}`.

In `login-page.tsx`, remove `tenantSlug` and the company input. Description `Entre com e-mail e senha.`

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd apps/web test -- src/features/auth/register-form.test.ts`

Expected: PASS. Then run `bun run --cwd apps/web build` and fix type errors in the auth screens.

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/vitest.config.ts apps/web/src/features/auth bun.lock
git commit -m "feat: register and log in with email and password"
```

Use the lockfile name that Bun actually changes.

---

### Task 11: Sidebar, select e criação da primeira empresa

**Files:**
- Modify: `apps/web/src/features/auth/api.ts`
- Modify: `apps/web/src/features/auth/authenticated-layout.tsx`
- Modify: `apps/web/src/features/home/home-page.tsx`
- Create: `apps/web/src/features/auth/company-panel.tsx`
- Test: `apps/web/src/features/auth/company-panel.test.ts`

**Interfaces:**
- Consumes: `AuthProfile.companies`, `AuthProfile.tenant`, `POST /auth/companies`, `POST /auth/tenant`, `readTokens` de `token-store.ts`, `saveSession`, `queryClient.clear`, router `invalidate`.
- Produces:
  - `showCreateCompany(tenant: AuthProfile['tenant']): boolean`
  - `createCompanyRequest({ name, refreshToken })`
  - `switchCompanyRequest({ tenantId, refreshToken })`
  - Layout com `SidebarProvider`, select e botão `Sair`.
  - Home mostra o formulário quando `showCreateCompany` é verdadeiro.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/features/auth/company-panel.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { showCreateCompany } from './company-panel';

describe('showCreateCompany', () => {
  it('shows the form when the session has no company', () => {
    expect(showCreateCompany(null)).toBe(true);
  });

  it('hides the form when a company is selected', () => {
    expect(
      showCreateCompany({ id: 'tenant-1', slug: 'acme', name: 'Acme' }),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd apps/web test -- src/features/auth/company-panel.test.ts`

Expected: FAIL with "Cannot find module './company-panel'".

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/features/auth/company-panel.tsx`:

```tsx
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function showCreateCompany(
  tenant: { id: string; slug: string; name: string } | null,
): boolean {
  return tenant === null;
}

export function CreateCompanyForm({
  pending,
  error,
  onSubmit,
}: {
  pending: boolean;
  error: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Criar empresa</h1>
        <p className="text-muted-foreground">
          Esta conta ainda não tem uma empresa. Crie a primeira para abrir o painel.
        </p>
      </header>
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="companyName">Empresa</Label>
          <Input id="companyName" minLength={2} name="companyName" required />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button disabled={pending} type="submit">
          Criar empresa
        </Button>
      </form>
    </main>
  );
}
```

Add to `api.ts`:

```ts
export async function createCompanyRequest(input: {
  name: string;
  refreshToken: string;
}): Promise<AuthSession> {
  const { data, error } = await getApi().auth.companies.post(input);

  if (error) {
    throw toAuthRequestError(error);
  }

  return readSession(data);
}

export async function switchCompanyRequest(input: {
  tenantId: string;
  refreshToken: string;
}): Promise<AuthSession> {
  const { data, error } = await getApi().auth.tenant.post(input);

  if (error) {
    throw toAuthRequestError(error);
  }

  return readSession(data);
}
```

Replace `authenticated-layout.tsx` with a sidebar shell:

```tsx
import { getRouteApi, Outlet, useNavigate, useRouter } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { queryClient } from '../../query-client';
import { switchCompanyRequest, AuthRequestError } from './api';
import { logoutSession, saveSession } from './session';
import { readTokens } from './token-store';

const authenticatedRoute = getRouteApi('/_authenticated');

export function AuthenticatedLayout() {
  const { auth } = authenticatedRoute.useRouteContext();
  const navigate = useNavigate();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const displayName = auth.user.name ?? auth.user.email;

  const logout = useCallback(() => {
    void logoutSession().finally(() => {
      queryClient.clear();
      void navigate({ to: '/login' });
    });
  }, [navigate]);

  const onSwitch = useCallback(
    (tenantId: string) => {
      if (tenantId === auth.tenant?.id) {
        return;
      }

      const refreshToken = readTokens()?.refreshToken;

      if (!refreshToken) {
        void navigate({ to: '/login' });
        return;
      }

      setError(null);
      void switchCompanyRequest({ tenantId, refreshToken })
        .then((session) => {
          saveSession(session);
          queryClient.clear();
          return router.invalidate();
        })
        .catch((reason: unknown) => {
          if (reason instanceof AuthRequestError) {
            setError(reason.message);
            return;
          }

          setError('Não foi possível trocar de empresa.');
        });
    },
    [auth.tenant?.id, navigate, router],
  );

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="gap-3 p-4">
          <p className="text-sm font-medium">MyroPhone</p>
          <Select
            disabled={auth.companies.length === 0}
            onValueChange={onSwitch}
            value={auth.tenant?.id}
          >
            <SelectTrigger aria-label="Empresa">
              <SelectValue placeholder="Nenhuma empresa" />
            </SelectTrigger>
            <SelectContent>
              {auth.companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </SidebarHeader>
        <SidebarContent />
        <SidebarFooter className="p-4">
          <p className="text-sm">{displayName}</p>
          <Button onClick={logout} type="button" variant="outline">
            Sair
          </Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex items-center p-2 md:hidden">
          <SidebarTrigger />
        </header>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
```

In `home-page.tsx`, when `showCreateCompany(auth.tenant)` is true, render `CreateCompanyForm`. On submit, read `companyName` and `readTokens().refreshToken`, call `createCompanyRequest`, `saveSession`, `queryClient.clear()`, and `router.invalidate()`. When a company exists, keep the current panel, reading `auth.tenant.name` only inside that branch.

Check `readTokens` in `token-store.ts`. If it returns `{ accessToken, refreshToken } | null`, use that. If the export name differs, use the existing reader instead of adding another store.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd apps/web test`

Expected: PASS. Then run `bun run --cwd apps/web build`.

Browser check, with API and web running:

1. Open `/register`, create an account with name, phone, email, password, and confirmation. The next screen is the panel with an empty company select and the create-company form.
2. Submit a company name. The select shows that company and the panel shows role `OWNER`.
3. Log out and log in with email and password only. The same company is selected.
4. There is no second-company action and no company field on the login screen.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/auth apps/web/src/features/home/home-page.tsx
git commit -m "feat: switch companies from the sidebar"
```

---

## Self-review

Spec coverage:

- Cadastro com nome, telefone, e-mail, senha e confirmação: Tasks 5 e 10.
- Sessão sem empresa e token sem `tenantId`: Tasks 1, 4 e 5.
- Login só com e-mail e senha, última empresa ou a mais antiga: Task 6.
- Criar só a primeira empresa: Task 7.
- Select troca a empresa na mesma sessão: Tasks 8 e 11.
- `NO_ACTIVE_TENANT` nas rotas de empresa: Task 9.
- Avatar e confirmação de e-mail só como colunas: Task 1, preenchidas com vazio na Task 5.
- Convite e segunda empresa ficam de fora: nenhum endpoint além do `403` da Task 7.
- Testes de API e telas: Tasks 5 a 11.

Placeholder scan: funções novas estão escritas. A Task 5 descreve a atualização de `toAuthContext` porque o arquivo já tem o corpo; os campos novos e as assinaturas estão fixos.

Type consistency: `registerAccount`, `chooseActiveTenantId`, `createFirstCompany`, `switchCompany`, `requireTenantContext`, `createCompanyRequest`, `switchCompanyRequest`, `showCreateCompany` e `registerPasswordError` usam os mesmos nomes nas tasks seguintes.
