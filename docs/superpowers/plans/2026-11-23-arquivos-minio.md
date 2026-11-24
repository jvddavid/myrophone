# Arquivos no MinIO — plano de implementação

**Spec:** `docs/superpowers/specs/2026-11-23-arquivos-minio-design.md`

A API em `apps/api` passa a receber o arquivo, gravar no MinIO e registrar `StoredFile` na empresa da sessão. Sem convite, sem tela de permissão e sem upload direto do navegador para o bucket.

## Modelo

`StoredFile` em `apps/api/prisma/schema.prisma`, com os enums `StoredFileVisibility` (`PUBLIC`, `PRIVATE`) e `StoredFilePurpose` (`AVATAR`, `PUBLIC_IMAGE`, `DOCUMENT`, `VALIDATION`).

Campos: `id`, `tenantId` (cascade), `uploadedByUserId` opcional (set null), `visibility`, `purpose`, `bucket`, `objectKey`, `originalName`, `contentType`, `sizeBytes`, `createdAt`. Único `(bucket, objectKey)`. Índices em `tenantId` e `uploadedByUserId`. Sem coluna de URL.

Migração SQL em `apps/api/prisma/migrations/20261123203400_add_stored_file/migration.sql`.

`AVATAR` e `PUBLIC_IMAGE` são `PUBLIC`. `DOCUMENT` e `VALIDATION` são `PRIVATE`. A combinação inversa responde `422 FILE_VISIBILITY_MISMATCH`. Imagens jpeg, png, webp e gif nos dois; pdf só no privado. Máximo 5 MiB. Vazio é rejeitado. Chave `{tenantId}/{uuid}`.

## Ambiente e buckets

`docker-compose.yml` na raiz sobe o MinIO em `9000`/`9001` com `minioadmin`/`minioadmin`. `apps/api/.env.example` lista as variáveis. `apps/api/src/core/config/env.ts` usa os mesmos padrões locais.

Cliente `@aws-sdk/client-s3` e `@aws-sdk/s3-request-presigner`, path-style, checksum só quando obrigatório (compatível com MinIO).

Na subida (`apps/api/src/index.ts`), os dois buckets são criados se faltarem. O público recebe política de `s3:GetObject` em `arn:aws:s3:::{bucket}/*`, sem `ListBucket`. O privado não recebe política anônima. `NODE_ENV=test` não chama o MinIO. `development` registra o erro e segue. Nos outros ambientes, a falha sobe e o processo não escuta.

URL pública: `S3_PUBLIC_BASE_URL` + chave. URL privada: GET pré-assinado por 300 segundos, gerado na leitura, nunca persistido. Avatar grava essa URL pública em `User.avatarUrl`.

## Rotas

`apps/api/src/modules/files/`, montado em `apps/api/src/app.ts`.

- `POST /files` — `multipart`: `file`, `purpose`. Visibilidade derivada. `201`.
- `GET /files/:id` — metadados e `url`. `404` se não for da empresa da sessão.
- `DELETE /files/:id` — apaga linha, limpa avatar só se a URL pública bater, depois apaga o objeto.

Sessão com empresa ativa, o mesmo `requireAuthContext` + `requireTenantContext` das outras rotas. Sem permissão nova. `tenantId` do cliente é ignorado.

Transação do envio: linha, avatar e `ActionLog` (`files.upload` / `files.delete`, `entityType` `StoredFile`, metadata `purpose` e `visibility`). Se a transação falhar depois do `PutObject`, a API apaga o objeto.

Falha do MinIO nas rotas: `503 STORAGE_UNAVAILABLE`.

## Testes

Vitest ao lado do módulo, com armazenamento e banco falsos. Sem MinIO na suíte.

Cobrem incompatibilidade de propósito e visibilidade, tipo rejeitado, chave com o id da empresa e sem o nome original, URL pública estável, URL privada pré-assinada fora do registro, isolamento entre empresas, avatar gravado e limpo, e `deleteObject` quando o insert falha.

Comandos: `bun run --cwd apps/api test` e `bun run --cwd apps/api check`.
