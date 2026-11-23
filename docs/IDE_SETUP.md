# Setup de IDE (Zed e VS Code)

## Padrão recomendado

- Formatar no save
- Organizar imports no save
- Usar Biome para apps com Biome
- Usar ESLint para `apps/web`

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
