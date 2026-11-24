# Arquivos no MinIO

## Objetivo

A API guarda arquivos da empresa no MinIO, que fala o protocolo S3. O arquivo pertence à empresa da sessão. Quem enviou fica só no registro de auditoria. Outra empresa não lê, não baixa e não apaga.

O cliente envia o arquivo para a API em `multipart`. Nesta etapa o navegador não fala com o MinIO.

## Fora desta etapa

- Convite, vínculo, departamento e tela de permissão.
- Tela web de upload. O avatar na web continua fora; a API grava `User.avatarUrl` quando o propósito é avatar.
- URL pré-assinada de upload direto para o bucket.

Qualquer membro com sessão e empresa ativa pode enviar, ler e apagar arquivo daquela empresa. Não há chave nova de permissão.

## Buckets

Dois buckets, criados na subida da API quando o MinIO responde:

| Bucket | Uso | Leitura anônima |
| --- | --- | --- |
| `S3_PUBLIC_BUCKET` (padrão `myrophone-public`) | Avatar e imagem pública | `s3:GetObject` nos objetos. Sem `s3:ListBucket`. |
| `S3_PRIVATE_BUCKET` (padrão `myrophone-private`) | Documento e validação | Nenhuma. Sem política anônima e sem listagem. |

O cliente S3 usa path-style (`forcePathStyle: true`).

Política do bucket público, aplicada de novo a cada subida:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadObjects",
      "Effect": "Allow",
      "Principal": { "AWS": ["*"] },
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::myrophone-public/*"]
    }
  ]
}
```

`NODE_ENV=test` não cria bucket e não contacta o MinIO. Em `development`, falha de bootstrap é logada e a API continua; `POST /files`, `GET /files/:id` e `DELETE /files/:id` respondem `503 STORAGE_UNAVAILABLE` enquanto o armazenamento não responde. Fora de development e test, a falha de bootstrap impede o processo de escutar.

## Modelo `StoredFile`

- `id` `String` `@id @default(cuid())`
- `tenantId` `String`, relação `Tenant`, `onDelete: Cascade`
- `uploadedByUserId` `String?`, relação `User` (`StoredFileUploader`), `onDelete: SetNull`
- `visibility` `StoredFileVisibility`: `PUBLIC` | `PRIVATE`
- `purpose` `StoredFilePurpose`: `AVATAR` | `PUBLIC_IMAGE` | `DOCUMENT` | `VALIDATION`
- `bucket` `String`
- `objectKey` `String`
- `originalName` `String`
- `contentType` `String`
- `sizeBytes` `Int`
- `createdAt` `DateTime @default(now())`

Único `(bucket, objectKey)`. Índices em `tenantId` e `uploadedByUserId`.

Não existe coluna de URL. A URL assinada não entra no banco nem no `ActionLog`.

`User.avatarUrl` continua sendo a URL pública estável do avatar atual. Ela é atualizada neste fluxo; não é a fonte do arquivo.

## Regras do arquivo

A visibilidade nasce do propósito. Campo `visibility` do cliente é ignorado. Combinação trocada é rejeitada com `422 FILE_VISIBILITY_MISMATCH`.

| Propósito | Visibilidade |
| --- | --- |
| `AVATAR`, `PUBLIC_IMAGE` | `PUBLIC` |
| `DOCUMENT`, `VALIDATION` | `PRIVATE` |

Conteúdo público: `image/jpeg`, `image/png`, `image/webp`, `image/gif`.

Conteúdo privado: os mesmos, mais `application/pdf`.

O tipo é comparado em minúsculas, sem parâmetros (`image/png; charset=binary` vale como `image/png`). Outro tipo: `422 INVALID_CONTENT_TYPE`.

Tamanho máximo: 5 MiB (`5242880` bytes). Acima disso: `413 FILE_TOO_LARGE`. Zero byte ou tamanho inválido: `422 EMPTY_FILE`. Sem arquivo no formulário: `422 FILE_REQUIRED`. Propósito fora da lista: `422 INVALID_PURPOSE`.

A chave do objeto é `{tenantId}/{uuid}` gerada no servidor. O `tenantId` entra na chave. O nome original não entra. Nome original vai para `originalName`, no máximo 255 caracteres, só o último segmento do caminho, ou `arquivo` se vier vazio.

## URL

Calculada na leitura.

- Público: `{S3_PUBLIC_BASE_URL}/{objectKey}`, sem barra duplicada no fim da base. A mesma chave devolve sempre a mesma URL. Padrão da base: `http://127.0.0.1:9000/myrophone-public`.
- Privado: `GetObject` pré-assinado por 300 segundos (5 minutos). Não é igual à URL pública e não é gravado.

Avatar: depois que a linha existe, `User.avatarUrl` da pessoa que enviou recebe essa URL pública. Apagar o arquivo zera `avatarUrl` só de quem está com exatamente essa URL. Outro valor permanece.

## Upload e falha

1. Validar propósito, tipo e tamanho.
2. Gravar o objeto.
3. Numa transação: criar `StoredFile`, atualizar o avatar se o propósito for `AVATAR`, gravar `ActionLog` (`files.upload`, `entityType` `StoredFile`, metadata `purpose` e `visibility`).
4. Se a transação falhar, apagar o objeto. A URL pública não fica apontando para arquivo ausente, porque o avatar só é gravado nessa transação.
5. Se a transação concluir, o objeto permanece. A URL assinada, se for arquivo privado, é gerada depois do commit e só na resposta.

Na exclusão, a transação apaga a linha, zera o avatar compatível e grava `files.delete`. O objeto sai em seguida. Se o MinIO falhar nesse passo, a rota responde `503` e nenhuma URL pública daquele arquivo continua no banco.

Arquivo de outra empresa: `404 FILE_NOT_FOUND` na leitura e na exclusão. A resposta não diz que o arquivo existe em outro lugar. O objeto não é apagado.

O `tenantId` é o da sessão. Qualquer `tenantId` mandado pelo cliente é ignorado.

## Rotas

Todas exigem sessão. Sem sessão: `401 UNAUTHORIZED`. Sem empresa ativa: `403 NO_ACTIVE_TENANT`.

- `POST /files` — `multipart` com `file` e `purpose`. Resposta `201` com os metadados e `url`.
- `GET /files/:id` — metadados e `url`. `404` fora da empresa ativa.
- `DELETE /files/:id` — apaga objeto e linha na empresa ativa. Resposta `200` com `{ id, deleted: true }`.

Metadados na resposta: `id`, `tenantId`, `uploadedByUserId`, `purpose`, `visibility`, `originalName`, `contentType`, `sizeBytes`, `createdAt`, `url`. Sem `bucket` e sem `objectKey`.

## Ambiente local

`docker compose up -d` sobe o MinIO em `127.0.0.1:9000` e o console em `127.0.0.1:9001`. Usuário e senha locais: `minioadmin` / `minioadmin`. Postgres e Redis não entram nesse compose.

Variáveis, com o padrão de desenvolvimento igual ao compose:

- `S3_ENDPOINT` — `http://127.0.0.1:9000`
- `S3_REGION` — `us-east-1`
- `S3_ACCESS_KEY` — `minioadmin`
- `S3_SECRET_KEY` — `minioadmin`
- `S3_PUBLIC_BUCKET` — `myrophone-public`
- `S3_PRIVATE_BUCKET` — `myrophone-private`
- `S3_PUBLIC_BASE_URL` — `http://127.0.0.1:9000/myrophone-public`

Esses usuários e senhas são fallback de máquina local, no mesmo estilo da URL padrão do Postgres. Produção define as variáveis. O exemplo versionado é `apps/api/.env.example`.

## Auditoria

`ActionLog` no envio e na exclusão. `entityType` é `StoredFile`. Ações: `files.upload` e `files.delete`. Metadata só com `purpose` e `visibility`. Sem URL assinada.

## Testes

Vitest, sem MinIO. Cliente de armazenamento falso.

- propósito e visibilidade trocados são rejeitados
- tipo de conteúdo errado é rejeitado
- a chave contém o id da empresa e não contém o nome original
- a URL pública é estável e contém a base pública
- a URL privada é pré-assinada, diferente da pública, e não fica no registro
- arquivo de outra empresa não é lido nem apagado
- avatar preenche `User.avatarUrl`; apagar esse arquivo limpa só quando a URL confere
- falha ao inserir no banco chama a exclusão do objeto
