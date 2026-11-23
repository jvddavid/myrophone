# Guia de desenvolvimento

## Pré-requisitos

- Bun `1.4.4`
- Node.js compatível com toolchain local
- Redis local para filas (`worker` e jobs da `api`)
- PostgreSQL local para `api` (Prisma)

## Instalação

```bash
bun install
```

## Execução local

### VPS stack

```bash
bun run dev:api
bun run dev:web
bun run dev:worker
```

### Cloudflare local

```bash
bun run dev:cfworker
bun run dev:workflows
```

## Qualidade de código

```bash
bun run lint
bun run test
```

- `web`: ESLint
- `api`, `worker`, `workflows`, `cfworker`, `shared`: Biome

## Prisma (API)

```bash
cp apps/api/.env.auth.example apps/api/.env
bun run --cwd apps/api prisma:generate
bun run --cwd apps/api prisma:migrate:dev
bun run --cwd apps/api prisma:seed
```

Prisma v7 usa `apps/api/prisma.config.ts` para `DATABASE_URL`.

## API HTTP middlewares

Variáveis opcionais:

- `CORS_ALLOWED_ORIGINS`: lista separada por vírgula (ex.: `https://app.myrophone.com,http://localhost:5173`).
  - Use `*` para liberar qualquer origem (padrão em desenvolvimento).
- `LOG_HTTP_REQUESTS`: `true`/`false` para habilitar logs de requisição HTTP na API.
- `LOG_LEVEL`: nível de log (`trace`, `debug`, `info`, `warn`, `error`, `fatal`) para API/worker.

Erros de validação agora retornam `details.issues[]` com:

- `field`: propriedade inválida
- `reason`: motivo do erro
- `expected` / `received` quando disponível

## Jobs e filas

Variáveis principais:

- `REDIS_HOST`
- `REDIS_PORT`
- `JOBS_DEFAULT_TIMEOUT_MS`
- `JOBS_DEFAULT_CONCURRENCY`
- `JOBS_TIMEOUT_OVERRIDES` (ex.: `tenantHierarchyExport=180000`)
- `JOBS_CONCURRENCY_OVERRIDES` (ex.: `leadProcessing=8`)

Chaves de job atuais:

- `leadProcessing`
- `tenantHierarchyExport`

## Cloudflare + Wrangler

Se `wrangler` falhar por permissão de escrita em diretório de config local, execute com `XDG_CONFIG_HOME` apontando para pasta dentro do projeto:

```bash
XDG_CONFIG_HOME=$(pwd)/.wrangler-home bun run --cwd apps/cfworker types
XDG_CONFIG_HOME=$(pwd)/.wrangler-home bun run --cwd apps/workflows types
```
