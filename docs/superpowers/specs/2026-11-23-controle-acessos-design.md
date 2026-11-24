# Controle de acessos da empresa

## Objetivo

O proprietário da empresa ativa decide quem entra nela. Ele convida uma conta que já existe, ou cria uma conta nova e escolhe em quais empresas dele essa pessoa entra. Dentro de cada empresa escolhida, ele coloca a pessoa em um departamento. Ele também vê os departamentos da empresa ativa e tira o acesso de alguém a essa empresa, sem apagar a conta.

Empresa é `Tenant`. Departamento é `Team`. O vínculo da pessoa com a empresa é `Membership`, com papel `OWNER`, `ADMIN` ou `USER`. O vínculo com o departamento é `TeamMembership`, pendurado em `Membership`, com papel `LEADER` ou `MEMBER`.

A empresa ativa é a da sessão (`Session.tenantId`). As telas gerenciam essa empresa. A exceção é criar um acesso em várias empresas: o corpo traz a lista de ids, e cada id precisa ser de uma empresa em que quem chama é `OWNER`.

## Fora desta etapa

- Envio de e-mail.
- MinIO, upload e `StoredFile`.
- Cobrança.
- Trocar a senha de alguém depois da criação.
- Transferir a propriedade da empresa.
- Criar outra empresa pela tela. Quem já tem empresa continua recebendo `COMPANY_CREATE_UNAVAILABLE` em `POST /auth/companies`.
- Mudar a autorização das rotas que já existem: `POST /users`, `GET /users`, `POST /teams`, `GET /teams`, `POST /teams/:teamId/members` e `DELETE /teams/:teamId/members/:userId`.

Este fluxo não cria outro `OWNER`. Convite e criação gravam `USER`.

## Quem pode fazer o quê

Só o `OWNER` da empresa alvo convida, cria acesso nessa empresa, muda departamento nela ou remove um membro dela. `ADMIN` e `USER` recebem `403` `NOT_COMPANY_OWNER` em todas as rotas novas, mesmo que tenham `users.manage` ou `teams.members.manage`.

Toda rota nova exige sessão com empresa ativa. Sem empresa, a resposta é `403` `NO_ACTIVE_TENANT`. Sem Bearer token válido, `401` `UNAUTHORIZED`.

O papel da sessão é o da empresa ativa. `POST /companies/members` também exige que o ator seja `OWNER` dessa empresa ativa, e que seja `OWNER` de cada empresa pedida no corpo. Um `ADMIN` da empresa ativa que seja dono de outra empresa não usa este fluxo enquanto a sessão estiver na empresa em que ele é `ADMIN`.

O proprietário não se remove se for o único `OWNER` ativo daquela empresa.

## Convidar ou criar

Convidar e criar são ações diferentes.

Convidar acha a conta pelo e-mail, já em minúsculas e sem espaços nas pontas. A conta precisa existir e estar ativa. O fluxo cria um `Membership` `ACTIVE` com papel `USER` na empresa da sessão. Não cria `TeamMembership`. A pessoa passa a ver essa empresa no select e entra nela pela troca de empresa que já existe.

Criar grava uma conta nova. Os campos são nome, telefone, e-mail e senha inicial. O nome segue `normalizeName` (mínimo 2 caracteres, sem espaços nas pontas). O telefone segue `normalizePhone` (8 a 20 caracteres, dígitos e `+`, espaço, `(`, `)`, `-`). O e-mail fica em minúsculas. A senha tem no mínimo 8 caracteres e é guardada com `hashPassword` de `apps/api/src/modules/auth/password.ts`. A resposta não devolve senha nem `passwordHash`. A conta nasce com `isActive` verdadeiro, `avatarUrl` vazio, `emailVerifiedAt` vazio e `lastTenantId` vazio. O fluxo não abre sessão para essa pessoa. Ela entra depois com `POST /auth/login`.

O corpo da criação não tem campo de papel. Cada empresa da lista ganha um `Membership` `ACTIVE` com papel `USER` e um `TeamMembership` com papel `MEMBER` no departamento informado.

## Várias empresas

No convite, na lista, na remoção e na troca de departamento, a empresa é a da sessão.

Na criação, o corpo é a lista. Cada item tem `tenantId` e `teamId`. A lista tem pelo menos uma empresa. O mesmo `tenantId` não se repete. Cada `tenantId` é uma empresa em que o ator tem `Membership` `ACTIVE` com papel `OWNER`. Empresa inexistente, empresa de outro dono e empresa em que o ator é só `ADMIN` ou `USER` respondem `COMPANY_NOT_OWNED`. O `teamId` é um `Team` ativo daquele `tenantId`. Departamento de outra empresa, id desconhecido ou departamento inativo respondem `TEAM_NOT_IN_COMPANY`.

A empresa ativa pode ficar de fora da lista. Isso acontece quando o proprietário desmarca a empresa atual e marca outra empresa que ele possui. A sessão dele não muda.

Se qualquer item da lista falha, nenhuma conta e nenhum vínculo são gravados.

## Departamento

Uma pessoa entra num departamento por `TeamMembership` do `Membership` daquela empresa. Remover o `Membership` apaga esses `TeamMembership` por `onDelete: Cascade`.

`PUT /companies/members/:userId/team` deixa a pessoa em um departamento da empresa ativa:

- O alvo tem `Membership` `ACTIVE` nessa empresa. Caso contrário, `MEMBERSHIP_NOT_FOUND`.
- O departamento é um `Team` ativo dessa empresa. Caso contrário, `TEAM_NOT_IN_COMPANY`.
- Se a pessoa já está só nesse departamento, a resposta repete o papel atual do `TeamMembership` (`LEADER` ou `MEMBER`) e não grava outro `ActionLog`.
- Nos outros casos, o fluxo apaga os `TeamMembership` daquele `Membership` e cria um, com papel `MEMBER`.
- Se a pessoa é o único `LEADER` de um departamento que ela deixaria, nada muda e a resposta é `LAST_TEAM_LEADER`. Essa trava já existe em `removeTeamMember`. O dono da empresa costuma ser o `LEADER` do departamento `Geral` criado em `createFirstCompany`. Mover esse dono para outro departamento cai nessa trava enquanto ele for o único líder.

A lista de membros devolve um departamento: o `TeamMembership` de `createdAt` mais antigo. Sem departamento, `team` é `null`. Quem foi convidado fica assim até o proprietário escolher um departamento.

`GET /teams` continua igual e serve para listar os departamentos, inclusive os vazios. A tela usa os departamentos com `isActive` verdadeiro.

## Remover de uma empresa

`DELETE /companies/members/:userId` apaga o `Membership` da empresa ativa. Os `TeamMembership` dessa empresa saem junto, pelo cascade. A linha de `User` permanece. Os `Membership` das outras empresas permanecem. As `Session` não são revogadas. `lastTenantId` não é alterado.

Quem tinha a sessão nessa empresa passa a receber `401` `UNAUTHORIZED` em `GET /auth/me`, porque `resolveAuthContextFromRequest` já exige `Membership` ativo. Este fluxo não muda essa função. No próximo login, a escolha de empresa que já existe ignora vínculo que não está `ACTIVE`.

Se o alvo não tem `Membership` na empresa ativa, a resposta é `MEMBERSHIP_NOT_FOUND`.

Se o vínculo alvo está `ACTIVE`, o papel dele é `OWNER` e só existe um `OWNER` ativo nessa empresa, a resposta é `LAST_OWNER` e o vínculo permanece. Com dois ou mais `OWNER` ativos, um pode remover o outro. Um vínculo que não está `ACTIVE` é apagado mesmo que o papel da linha seja `OWNER`.

## Telas

As telas ficam no app que já existe, dentro de `AuthenticatedLayout`, ao lado da sidebar. Os itens novos entram no grupo Menu de `apps/web/src/features/auth/app-sidebar.tsx`, depois de Painel, só quando `auth.role === 'OWNER'`. Ícones `Users` e `Building2`, do mesmo jeito que Painel usa `LayoutDashboard`. No celular a sidebar continua a gaveta que o layout já tem.

| Rota | Arquivo da rota | Tela |
| --- | --- | --- |
| `/acessos` | `apps/web/src/routes/_authenticated/acessos/index.tsx` | Quem tem acesso |
| `/acessos/novo` | `apps/web/src/routes/_authenticated/acessos/novo.tsx` | Criar acesso, uma página só |
| `/departamentos` | `apps/web/src/routes/_authenticated/departamentos.tsx` | Departamentos e membros |

Sem empresa ativa, ou com papel diferente de `OWNER`, as três rotas mostram o vazio do componente `Empty`: título "Acesso do proprietário" e texto "Só o proprietário da empresa ativa gerencia acessos e departamentos." Nenhuma chamada de gestão sai nesse estado.

### Acessos

Título "Acessos". Texto "Pessoas que podem entrar nesta empresa."

A lista usa `Item`, como o painel em `apps/web/src/features/home/home-page.tsx`. Cada linha mostra nome, e-mail e o papel: Proprietário, Administrador ou Usuário, num `Badge`. A ordem é a da API, nome e depois e-mail.

Ações:

- "Convidar" abre um `Dialog`. Campo e-mail. Texto "A pessoa precisa já ter uma conta." Botão "Convidar".
- "Criar acesso" vai para `/acessos/novo`.
- "Remover" abre um `AlertDialog`. Título "Remover desta empresa". Texto "{nome} perde o acesso aos dados desta empresa. A conta continua e o acesso às outras empresas não muda." Botões "Cancelar" e "Remover".

Lista vazia: título "Nenhuma pessoa" e texto "Ninguém tem acesso a esta empresa."

Enquanto a lista carrega, um `Skeleton`. O erro da lista, do convite ou da remoção aparece em texto com `role="alert"`. O app não monta o `Toaster` de `sonner`; este fluxo também não monta.

### Criar acesso

Uma página, sem assistente de passos. O stack atual é TanStack Router, React e os componentes de `apps/web/src/components/ui`. Não há um wizard no produto, e esta tela não introduz um.

Campos, de cima para baixo, numa coluna:

- Nome
- Telefone
- E-mail
- Senha
- Uma caixa de seleção para cada empresa que o ator possui, vinda de `GET /companies/owned`. A empresa ativa começa marcada quando ela está nessa lista.
- Para cada empresa marcada, um `Select` "Departamento em {nome da empresa}". O valor inicial é o time com slug `geral`. Se não houver, é o primeiro time da lista, que a API já ordena pelo nome.

Botão "Criar acesso". Link "Voltar" para `/acessos`.

Antes do pedido, a página recusa envio com uma destas frases:

- "O nome precisa ter pelo menos 2 caracteres."
- "A senha precisa ter pelo menos 8 caracteres."
- "Escolha ao menos uma empresa."
- "Escolha o departamento de {nome da empresa}."

Sucesso volta para `/acessos`, que mostra a pessoa nova quando a empresa ativa estava na lista. A senha de confirmação não entra: o cadastro público tem confirmação; esta tela segue os campos fechados acima.

### Departamentos

Título "Departamentos". Texto "Quem está em cada departamento desta empresa."

Abas com o `Tabs` que já existe em `apps/web/src/components/ui/tabs.tsx`. Uma aba por departamento ativo de `GET /teams`. A aba "Sem departamento" aparece quando alguém da lista não tem departamento ativo. A lista de abas rola na horizontal (`overflow-x-auto`) para caber no celular.

Dentro da aba, cada pessoa aparece com nome e e-mail, e um `Select` "Departamento" com os departamentos ativos. Trocar o valor chama `PUT /companies/members/:userId/team` e recarrega as duas listas. O valor mostrado continua o da API até o pedido terminar. Falha deixa a pessoa no departamento anterior e mostra o alerta.

Sem departamento ativo: título "Nenhum departamento" e texto "Esta empresa ainda não tem um departamento ativo."

## API

As rotas entram em `managementRoutes` (`apps/api/src/modules/auth/http/management.routes.ts`), no mesmo `Elysia` e no mesmo `toErrorResponse`. O serviço novo fica em `apps/api/src/modules/auth/company-access.ts`. `app.ts` já monta `managementRoutes`; esta etapa não mexe nele.

Autenticação: `Authorization: Bearer`. Estas rotas não recebem `refreshToken`. A empresa da sessão vem do access token, como em `GET /teams`.

Corpo de erro, igual ao das rotas atuais:

```json
{ "error": "CODIGO", "message": "English message" }
```

Validação do schema Elysia continua no `onError` global: `422` e `VALIDATION_ERROR`, com `details`. `AppError` lançado no handler volta pelo `toErrorResponse` da rota, com o status do erro.

`GET /companies/owned` existe porque `GET /auth/me` lista empresas sem papel, e `GET /teams` só lista a empresa ativa. O formulário precisa das empresas em que o ator é `OWNER` e dos departamentos de cada uma.

### POST /companies/members/invite

Corpo: `{ "email": string, "role"?: "USER" }`. Sem `role`, o papel é `USER`. Outro valor de `role` é `422` `VALIDATION_ERROR`.

Sucesso `201`:

```json
{
  "userId": "cuid",
  "email": "pessoa@exemplo.com",
  "name": "Pessoa",
  "role": "USER",
  "membershipId": "cuid"
}
```

### POST /companies/members

Corpo:

```json
{
  "name": "Pessoa",
  "phone": "(11) 98765-4321",
  "email": "pessoa@exemplo.com",
  "password": "senha-forte",
  "companies": [{ "tenantId": "cuid", "teamId": "cuid" }]
}
```

`companies` tem no mínimo um item. `tenantId` e `teamId` são strings não vazias. Não há campo `role`.

Sucesso `201`. `memberships` segue a ordem de `companies`.

```json
{
  "user": {
    "id": "cuid",
    "name": "Pessoa",
    "email": "pessoa@exemplo.com",
    "phone": "(11) 98765-4321"
  },
  "memberships": [
    {
      "tenantId": "cuid",
      "membershipId": "cuid",
      "role": "USER",
      "team": { "id": "cuid", "name": "Geral", "slug": "geral" }
    }
  ]
}
```

### GET /companies/members

Sucesso `200`. Só vínculos `ACTIVE` da empresa ativa, ordenados por nome e, em empate, por e-mail.

```json
{
  "items": [
    {
      "userId": "cuid",
      "name": "Pessoa",
      "email": "pessoa@exemplo.com",
      "phone": "11987654321",
      "role": "OWNER",
      "team": { "id": "cuid", "name": "Geral", "slug": "geral" }
    }
  ]
}
```

`team` é `null` quando não há departamento.

### DELETE /companies/members/:userId

Sucesso `200`: `{ "removed": true }`.

### GET /companies/owned

Sucesso `200`. Empresas em que o ator tem `Membership` `ACTIVE` e papel `OWNER`, ordenadas pelo nome. Em cada uma, departamentos com `isActive` verdadeiro, ordenados pelo nome.

```json
{
  "items": [
    {
      "id": "cuid",
      "slug": "empresa",
      "name": "Empresa",
      "teams": [{ "id": "cuid", "slug": "geral", "name": "Geral" }]
    }
  ]
}
```

### GET /teams

Permanece. Resposta atual: `{ items: [{ id, slug, name, description, isActive, memberCount, leaderCount, permissionKeys }] }`. A tela de departamentos filtra `isActive`.

### PUT /companies/members/:userId/team

Corpo: `{ "teamId": string }`.

Sucesso `200`:

```json
{ "userId": "cuid", "teamId": "cuid", "role": "MEMBER" }
```

`role` aqui é o papel no departamento (`MEMBER`, ou `LEADER` quando a pessoa já estava só naquele departamento e o líder foi preservado).

## Erros

| Situação | Status | Código | Mensagem da API | Texto na tela |
| --- | --- | --- | --- | --- |
| E-mail do convite sem conta | 404 | `USER_NOT_REGISTERED` | No account exists for this email. Create the access instead. | Não há conta com este e-mail. Crie o acesso em vez de convidar. |
| E-mail já tem vínculo nesta empresa, em qualquer status | 409 | `ALREADY_IN_COMPANY` | This person already belongs to this company. | Esta pessoa já tem acesso a esta empresa. |
| Criar conta com e-mail que já existe | 409 | `EMAIL_IN_USE` | Email is already in use. | Este e-mail já tem conta. Convide a pessoa em vez de criar outro acesso. |
| Ator não é `OWNER` da empresa ativa | 403 | `NOT_COMPANY_OWNER` | Only the company owner can manage access. | Só o proprietário desta empresa pode gerenciar acessos. |
| Empresa da lista não é do ator | 403 | `COMPANY_NOT_OWNED` | You can only add this person to a company you own. | Você só pode incluir uma empresa da qual é proprietário. |
| Departamento de outra empresa, inexistente ou inativo | 400 | `TEAM_NOT_IN_COMPANY` | The department does not belong to this company. | O departamento não pertence a esta empresa. |
| Remover o único `OWNER` ativo | 409 | `LAST_OWNER` | The last owner of this company cannot be removed. | Você é o último proprietário desta empresa e não pode se remover. |
| Mover o único líder para fora do departamento | 400 | `LAST_TEAM_LEADER` | This person is the last leader of their current department. | Esta pessoa é a última líder do departamento atual. O departamento precisa de outro líder antes da mudança. |
| Alvo sem vínculo ativo na empresa | 404 | `MEMBERSHIP_NOT_FOUND` | This person does not belong to this company. | Esta pessoa não pertence a esta empresa. |
| Conta desativada no convite | 403 | `USER_DISABLED` | This account is disabled. | Esta conta está desativada. |
| Mesma empresa repetida na lista | 400 | `DUPLICATE_COMPANY` | Each company can appear only once. | Cada empresa só pode aparecer uma vez. |
| Sessão sem empresa | 403 | `NO_ACTIVE_TENANT` | An active company is required. | Escolha uma empresa antes de gerenciar acessos. |
| Sem sessão | 401 | `UNAUTHORIZED` | Authentication is required. | Sua sessão expirou. Entre de novo. |
| Schema Elysia (e-mail inválido, senha curta, nome curto, lista vazia, `role` diferente de `USER`) | 422 | `VALIDATION_ERROR` | Request payload is invalid. | Revise os campos e tente de novo. |
| Telefone que passa o tamanho do schema e falha em `normalizePhone` | 400 | `VALIDATION_ERROR` | Phone number is invalid. | Revise os campos e tente de novo. |

O texto da tela vive em `apps/web/src/features/access/messages.ts`. O mapa de `apps/web/src/features/auth/types.ts` permanece o do login. `EMAIL_IN_USE` nesta tela usa a frase de convite, não a frase "Este e-mail já está em uso."

## Registro de ações

`ActionLog` usa as ações abaixo. `entityType` é `membership`. `entityId` é o id do `Membership`. `actorUserId` é o proprietário. `tenantId` é a empresa da ação. `ipAddress` e `userAgent` vêm de `getRequestMeta`.

| Ação | Quando | `teamId` | `metadata` |
| --- | --- | --- | --- |
| `members.invite` | Convite gravado | vazio | `{ userId, email }` |
| `members.create` | Um log por empresa da criação | departamento escolhido | `{ userId, email, teamId }` |
| `members.remove` | Antes de apagar o vínculo, na mesma transação | vazio | `{ userId, email }` |
| `members.team_assign` | Departamento trocado de fato | departamento novo | `{ userId, previousTeamIds }` |

A repetição idempotente de `PUT` não gera log.

## Dados

Nenhuma coluna nova. `User`, `Membership`, `Role`, `Team`, `TeamMembership`, `Session` e `ActionLog` já cobrem o fluxo. `schema.prisma` fica como está, inclusive se outro trabalho acrescentar arquivo nele: este fluxo não altera o schema.

O departamento padrão da primeira empresa continua slug `geral` e nome `Geral`. O proprietário continua `LEADER` desse departamento. Pessoa criada por este fluxo entra como `MEMBER`. Pessoa convidada fica sem departamento até o `PUT`.

## Testes

Na API, contra o Postgres de `DATABASE_URL`, no estilo de `apps/api/src/modules/auth/http/login.flow.test.ts`. E-mails em `@auth-test.local`. Empresas com nome começando em `Auth Test`, para o `cleanupAuthTests` atual apagar o rastro. A segunda empresa do mesmo dono nasce por Prisma e `ensureTenantRbac`, porque `POST /auth/companies` recusa a segunda empresa.

Cobertura:

- Convite de conta existente cria `USER` ativo, sem departamento, e a pessoa vê a empresa no login.
- Convite de e-mail desconhecido, e-mail já na empresa, conta desativada, `ADMIN`, `USER`, sessão sem empresa e sem token.
- `role: "OWNER"` no convite é `422`.
- Criação em duas empresas do ator, papel `USER` e departamento `MEMBER`, login da conta nova nas duas.
- Criação com e-mail já usado, empresa que o ator não possui, departamento de outra empresa, empresa repetida e lista vazia. Nada é gravado no caso de erro.
- `ADMIN` da empresa ativa, mesmo dono de outra empresa, recebe `NOT_COMPANY_OWNER`.
- Lista só da empresa ativa, com departamento ou `null`.
- Remoção apaga o vínculo e o departamento daquela empresa, conserva a conta, conserva a outra empresa e responde `LAST_OWNER` para o único proprietário.
- Troca de departamento, departamento de outra empresa, último líder e repetição do mesmo departamento.
- `GET /companies/owned` devolve só empresas em que o ator é `OWNER`, com os departamentos ativos.
- Cada ação grava o `ActionLog` correspondente.

Na web, Vitest em `node`, no estilo de `register-form.test.ts`: rótulos, frases de erro, empresa ativa marcada e departamento por empresa selecionada. As telas em si entram na verificação de uso, nos dois viewports.
