# Arquitetura e padrão de pastas

## Visão geral

O projeto separa responsabilidades em duas camadas:

- **VPS (camada fixa)**: `api`, `web`, `worker`
- **Cloudflare (camada elástica)**: `cfworker`, `workflows`, D1 por tenant

## Estrutura do monorepo

```txt
apps/
  api/
  web/
  worker/
  workflows/
  cfworker/
packages/
  shared/
```

## Padrão de pastas por app

### API (`apps/api/src`)

```txt
core/
  config/
  db/
  errors/
modules/
  auth/
    http/
  jobs/
    http/
```

### Worker (`apps/worker/src`)

```txt
core/
  jobs/
infra/
modules/
  lead-processing/
  tenant-hierarchy-export/
```

### Workflows (`apps/workflows/src`)

```txt
core/
modules/
  lead-workflow/
  http/
```

### CF Worker (`apps/cfworker/src`)

```txt
core/
modules/
  ingest/
  health/
```

### Shared (`packages/shared/src`)

```txt
core/
jobs/
index.ts
```

## Convenções

- `core/`: capacidades transversais do app (configuração, tipos base, runtime, erro, DB)
- `infra/`: integrações externas (fila, adaptadores, clientes)
- `modules/<feature>/`: domínio por funcionalidade
- `modules/<feature>/http`: camada HTTP da feature
- `packages/shared`: contratos/tipos/helpers sem acoplamento com infra de app

## Regras práticas de evolução

1. Feature nova começa em `modules/<feature>`.
2. Se utilitário for transversal do app, mover para `core/`.
3. Se for contrato reutilizado por apps, mover para `packages/shared`.
4. Evitar importar entre features diferentes sem passar por `core`/`shared`.
5. Rotas HTTP não devem conter regra de negócio pesada; delegar para serviço/processador.
