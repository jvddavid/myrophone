# MyroPhone Monorepo

Monorepo em **Bun Workspaces** para um SaaS multi-tenant focado em conexões WhatsApp Web, recebimento de leads e processamento em alta escala.

## Apps e pacotes

```txt
apps/
  api/        -> Bun + Elysia + Prisma + Vitest (VPS)
  web/        -> Vite + React + TailwindCSS + ESLint (VPS)
  worker/     -> Node.js + BullMQ + Vitest (VPS)
  workflows/  -> Cloudflare Workflows
  cfworker/   -> Cloudflare Worker
packages/
  shared/     -> tipos e contratos compartilhados
```

## Quick start

```bash
bun install

bun run dev:api
bun run dev:web
bun run dev:worker
```

Cloudflare local:

```bash
bun run dev:cfworker
bun run dev:workflows
```

## Scripts úteis (root)

- `bun run lint`
- `bun run test`
- `bun run dev:api`
- `bun run dev:web`
- `bun run dev:worker`
- `bun run dev:cfworker`
- `bun run dev:workflows`

## Documentação

- [Arquitetura e padrão de pastas](./docs/ARCHITECTURE.md)
- [Guia de desenvolvimento](./docs/DEVELOPMENT.md)
- [Setup de IDE (Zed e VS Code)](./docs/IDE_SETUP.md)

## Infra (resumo)

- **VPS**: `api`, `web`, `worker` (camada fixa/core).
- **Cloudflare**: `workflows`, `cfworker` e expansão elástica por tenant.

## Auth e gestão multi-tenant (resumo)

- Hierarquia de tenant: `OWNER`, `ADMIN`, `USER`.
- Departamentos/times por tenant com `LEADER` e `MEMBER`.
- Usuário pode participar de múltiplos tenants e múltiplos times.
- Jobs assíncronas com fila no Redis e processamento no worker.

## Rotas principais (API)

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /tenants/current`
- `GET /permissions/me`
- `GET /teams`
- `POST /teams`
- `PUT /teams/:teamId/permissions`
- `POST /teams/:teamId/members`
- `DELETE /teams/:teamId/members/:userId`
- `GET /users`
- `POST /users`
- `GET /action-logs`
- `POST /jobs/tenant-hierarchy-export`
- `GET /jobs/tenant-hierarchy-export/:jobId`
- `GET /jobs/tenant-hierarchy-export/:jobId/file`
