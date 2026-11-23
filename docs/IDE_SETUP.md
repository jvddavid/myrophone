# Setup de IDE (Cursor, Zed e VS Code)

## Padrão recomendado

- Formatar no save
- Organizar imports no save
- Usar Biome para apps com Biome
- Usar ESLint para `apps/web`

## Cursor

O Cursor lê a configuração de workspace do VS Code e os servidores MCP do projeto.

Arquivos:

- `.vscode/settings.json`
- `.vscode/extensions.json`
- `.cursor/mcp.json`

MCPs remotos da Cloudflare registrados no projeto:

- `cloudflare-api` em `https://mcp.cloudflare.com/mcp` (API completa em Code Mode)
- `cloudflare-docs` em `https://docs.mcp.cloudflare.com/mcp`
- `cloudflare-agents` em `https://agents.cloudflare.com/mcp`
- `cloudflare-browser` em `https://browser.mcp.cloudflare.com/mcp`
- `cloudflare-containers` em `https://containers.mcp.cloudflare.com/mcp`
- `cloudflare-blog` em `https://blog.mcp.cloudflare.com/mcp`
- `cloudflare-casb` em `https://casb.mcp.cloudflare.com/mcp`
- `cloudflare-dex` em `https://dex.mcp.cloudflare.com/mcp`
- `context7` via `@upstash/context7-mcp` (documentação atualizada de bibliotecas)
- `postgres` via Postgres MCP Pro, ligado ao PostgreSQL local `postgresql://postgres:postgres@127.0.0.1:5432/myrophone` em modo `unrestricted`
- `redis` via Redis MCP oficial, ligado a `redis://127.0.0.1:6379/0` (filas BullMQ da API e do worker)

Na primeira chamada de um servidor remoto da Cloudflare, o Cursor abre o OAuth para autorizar a conta e as permissões. O Context7 funciona sem chave, com limite de taxa menor. O Postgres MCP só responde depois que o banco local `myrophone` estiver no ar. O Redis MCP só responde depois que o Redis local estiver no ar.

Wrangler fica instalado na raiz do workspace. Na raiz do repositório:

```bash
bun run wrangler --version
```

## Zed

Arquivo de workspace: `.zed/settings.json`

Config aplicada neste repositório:

- `format_on_save` ligado
- `formatter` via language server
- `source.organizeImports` no format
- indentação em 2 espaços

## VS Code

Arquivos de workspace:

- `.vscode/settings.json`
- `.vscode/extensions.json`

Config aplicada:

- format on save
- organize imports no save
- Biome como formatter padrão para TS/JS/JSON
- ESLint como formatter para TSX/JSX
- `eslint.workingDirectories` apontando para `apps/web`

Extensões recomendadas:

- `biomejs.biome`
- `dbaeumer.vscode-eslint`
- `bradlc.vscode-tailwindcss`

## EditorConfig

Arquivo `.editorconfig` define padrão de:

- `utf-8`
- `lf`
- newline final
- indentação em 2 espaços
- preservação de trailing whitespace em Markdown
