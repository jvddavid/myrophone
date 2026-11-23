# Login, conta e empresa ativa

## Objetivo

A pessoa entra com e-mail e senha. A conta existe antes de qualquer empresa. Depois do login, o painel tem uma sidebar ao lado do conteúdo principal. O select da sidebar troca, a qualquer momento, a empresa ativa entre as que já estão vinculadas à conta.

## Fora desta etapa

- Envio e confirmação de e-mail.
- Upload de avatar.
- Convite para outra empresa.
- Criar uma segunda empresa.
- Login social ou outro método além de e-mail e senha.

A conta já guarda `emailVerifiedAt` e `avatarUrl` vazios. Nenhum dos dois bloqueia o login.

## Conta

O cadastro pede nome, telefone, e-mail, senha e confirmação da senha.

- Nome: obrigatório, no mínimo 2 caracteres.
- Telefone: obrigatório, de 8 a 20 caracteres, depois de remover espaços nas pontas. Pode conter dígitos e os separadores `+`, espaço, `(`, `)`, `-`.
- E-mail: obrigatório, único, guardado em minúsculas.
- Senha e confirmação: as duas precisam ser iguais e ter no mínimo 8 caracteres. A confirmação fica na tela e não vai para a API.

O cadastro cria só a conta, abre a sessão e leva ao painel. A sessão nasce sem empresa.

## Sessão

A sessão pertence à pessoa. `Session.tenantId` pode ficar vazio. O access token omite `tenantId` quando não há empresa ativa. Tokens antigos, que já trazem `tenantId`, continuam válidos.

O refresh token não muda quando a empresa da sessão muda. A API devolve um access token novo e o mesmo refresh token. Refresh e `GET /auth/me` devolvem o mesmo formato de perfil.

### Login

O login recebe só e-mail e senha.

- Nenhuma empresa ativa: a sessão fica sem empresa.
- Uma ou mais: entra na última empresa gravada na conta, se o vínculo ainda estiver ativo. Se a pessoa nunca escolheu, ou se aquela empresa não está mais ativa, entra na empresa ativa mais antiga (`Membership.createdAt` crescente). Essa escolha é gravada em `User.lastTenantId`.

### Troca

O select envia o id de uma empresa com vínculo `ACTIVE`. A mesma sessão passa a apontar para ela, `lastTenantId` é atualizado e a API devolve um access token novo. O painel recarrega papel, permissões e times. Escolher a empresa que já está ativa não gera outra sessão.

### Saída

Sair revoga a sessão, apaga os tokens locais e volta para o login.

## Empresa

Quem não tem empresa ativa cria a primeira no conteúdo principal do painel. O formulário pede só o nome, no mínimo 2 caracteres. O identificador nasce do nome, com a normalização que a API já usa. Se o identificador já existir, a API acrescenta `-2`, `-3` e assim por diante até achar um livre. A pessoa vira `OWNER`, a empresa ganha o time padrão e a sessão passa a apontar para ela.

Quem já tem ao menos uma empresa ativa não cria outra nesta etapa. O select só lista empresas com vínculo `ACTIVE`, ordenadas pelo nome. A opção selecionada é a empresa da sessão.

## Telas

O cadastro mostra nome, telefone, e-mail, senha e confirmação. O título é criar conta. Ao concluir, a pessoa já está no painel.

O login mostra e-mail e senha. O campo de empresa sai dessa tela.

A área logada usa a sidebar que o projeto já tem, ao lado do conteúdo. No celular ela vira gaveta. Na sidebar ficam o select de empresas, o nome da pessoa e o botão de sair.

Sem empresa, o select fica vazio e o conteúdo principal mostra o formulário da primeira empresa. Com empresa, o conteúdo principal mostra o painel atual: papel, permissões e times da empresa selecionada. Trocar o select limpa o cache de consultas e recarrega esse conteúdo.

## API

O perfil, com ou sem tokens, tem esta forma:

- `sessionId`
- `membershipId`: string ou `null`
- `user`: `id`, `email`, `name`, `phone`, `avatarUrl`, `emailVerifiedAt`, `isActive`
- `tenant`: `{ id, slug, name }` ou `null`
- `companies`: lista `{ id, slug, name }` das empresas com vínculo ativo
- `role`: string ou `null`
- `permissions`, `teams`, `teamPermissions`: vazios quando não há empresa

Rotas:

- `POST /auth/register` com `name`, `phone`, `email`, `password`. Devolve a sessão sem empresa.
- `POST /auth/login` com `email` e `password`.
- `POST /auth/companies` autenticado, com `name` e `refreshToken`. Só quando a pessoa não tem empresa ativa. Confere o hash do refresh token com a sessão do access token, mantém essa sessão e devolve o perfil com access token novo e o mesmo refresh token.
- `POST /auth/tenant` autenticado, com `tenantId` e `refreshToken`. Troca a empresa da mesma sessão, com a mesma conferência do refresh token, e devolve o perfil com access token novo e o mesmo refresh token.
- `GET /auth/me`, `POST /auth/refresh` e `POST /auth/logout` permanecem, no formato novo.

Rotas que exigem empresa, como jobs, respondem `403` com `NO_ACTIVE_TENANT` enquanto a sessão estiver sem empresa.

## Dados

Em `User`:

- `name` obrigatório
- `phone` obrigatório
- `avatarUrl` opcional
- `emailVerifiedAt` opcional
- `lastTenantId` opcional, referência à empresa, `onDelete: SetNull`

Em `Session`, `tenantId` passa a ser opcional, com `onDelete: SetNull`. Sessões que já existem continuam com a empresa atual.

Se a tabela de contas já tiver linhas, a migration preenche `name` com a parte local do e-mail e `phone` com `00000000`. Esses valores só destravam as colunas obrigatórias. Conta nova continua passando pelas regras do cadastro.

## Erros

- `EMAIL_IN_USE`: e-mail já cadastrado.
- `INVALID_CREDENTIALS`: e-mail ou senha incorretos.
- `USER_DISABLED`: conta desativada.
- `VALIDATION_ERROR`: campo fora da regra.
- `COMPANY_CREATE_UNAVAILABLE` (`403`): a pessoa já tem empresa ativa.
- `MEMBERSHIP_NOT_ACTIVE` (`403`): a empresa pedida na troca não tem vínculo ativo. Vale também quando a empresa não existe.
- `NO_ACTIVE_TENANT` (`403`): a rota exige empresa e a sessão não tem uma.
- Senhas diferentes: a tela mostra "As senhas não coincidem." e não chama a API.

O login deixa de responder `TENANT_REQUIRED`.

## Testes

Na API:

- Cadastro cria a conta, abre sessão sem empresa e não cria tenant.
- Login com zero, uma e várias empresas ativas.
- A última empresa gravada vence a mais antiga, e uma última empresa inativa cai na mais antiga ainda ativa.
- Criar a primeira empresa define proprietário, sessão e `lastTenantId`.
- Criar empresa de novo responde `COMPANY_CREATE_UNAVAILABLE`.
- Trocar de empresa mantém a sessão e o refresh token, troca o access token e grava `lastTenantId`.
- Trocar para empresa sem vínculo responde `MEMBERSHIP_NOT_ACTIVE`.
- Uma rota que exige empresa responde `NO_ACTIVE_TENANT` sem empresa na sessão.

Nas telas: cadastro, login sem campo de empresa, painel sem empresa, criação da primeira empresa e troca no select, inclusive o recarregamento do papel e das permissões.
