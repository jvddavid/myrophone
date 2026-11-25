/**
 * Catálogo de permissões do tenant.
 * `ownerOnly` fica de fora dos modelos de ADMIN e USER e não pode ser
 * concedida a esses papéis. Hoje só `permissions.manage` é exclusiva do
 * proprietário: editar os modelos da empresa, editar as concessões de uma
 * pessoa e promover alguém a proprietário.
 */
export const permissionCatalog = [
  {
    key: 'tenant.read',
    description: 'Ler dados da empresa',
    group: 'Empresa',
    ownerOnly: false,
  },
  {
    key: 'tenant.manage',
    description: 'Editar nome, descrição e logo da empresa',
    group: 'Empresa',
    ownerOnly: false,
  },
  {
    key: 'users.read',
    description: 'Listar pessoas da empresa',
    group: 'Pessoas',
    ownerOnly: false,
  },
  {
    key: 'users.manage',
    description: 'Convidar, criar e remover pessoas da empresa',
    group: 'Pessoas',
    ownerOnly: false,
  },
  {
    key: 'teams.read',
    description: 'Listar departamentos',
    group: 'Departamentos',
    ownerOnly: false,
  },
  {
    key: 'teams.manage',
    description: 'Criar e editar departamentos',
    group: 'Departamentos',
    ownerOnly: false,
  },
  {
    key: 'teams.members.manage',
    description: 'Incluir e mover pessoas nos departamentos',
    group: 'Departamentos',
    ownerOnly: false,
  },
  {
    key: 'permissions.read',
    description: 'Visualizar permissões e papéis',
    group: 'Permissões',
    ownerOnly: false,
  },
  {
    key: 'permissions.manage',
    description:
      'Editar os modelos de permissão da empresa e as concessões de cada pessoa. Reservada ao proprietário. Também é exigida para promover alguém a proprietário.',
    group: 'Permissões',
    ownerOnly: true,
  },
  {
    key: 'logs.read',
    description: 'Ler o histórico de ações da empresa',
    group: 'Auditoria',
    ownerOnly: false,
  },
] as const;

export const teamPermissionCatalog = [
  {
    key: 'dashboard.view',
    description: 'Ver o painel',
    group: 'Telas',
    ownerOnly: false,
  },
  {
    key: 'management.view',
    description: 'Ver as telas de gestão',
    group: 'Telas',
    ownerOnly: false,
  },
  {
    key: 'deliveries.view',
    description: 'Ver as telas de entregas',
    group: 'Telas',
    ownerOnly: false,
  },
  {
    key: 'sales.view',
    description: 'Ver as telas de vendas',
    group: 'Telas',
    ownerOnly: false,
  },
  {
    key: 'support.view',
    description: 'Ver as telas de atendimento',
    group: 'Telas',
    ownerOnly: false,
  },
  {
    key: 'reports.view',
    description: 'Ver as telas de relatórios',
    group: 'Telas',
    ownerOnly: false,
  },
] as const;

export type PermissionKey = (typeof permissionCatalog)[number]['key'];
export type TeamPermissionKey = (typeof teamPermissionCatalog)[number]['key'];

/**
 * Modelo USER ("visualizador"): só leitura e visualização.
 * Não inclui chaves `*.manage`, a tela de gestão (`management.view`)
 * nem permissões exclusivas do proprietário.
 * Membros já existentes não são reescritos quando este modelo muda.
 */
export const viewerPermissionKeys = [
  'tenant.read',
  'users.read',
  'teams.read',
  'permissions.read',
  'logs.read',
  'dashboard.view',
  'deliveries.view',
  'sales.view',
  'support.view',
  'reports.view',
] as const satisfies readonly (PermissionKey | TeamPermissionKey)[];

/**
 * O que um USER já conseguia fazer antes dos modelos por empresa:
 * as três leituras do papel e o painel, que não tinha trava.
 * O backfill usa esta lista e ainda copia as telas que o departamento
 * da pessoa já tinha.
 */
export const legacyUserGrantKeys = [
  'tenant.read',
  'users.read',
  'teams.read',
  'dashboard.view',
] as const satisfies readonly (PermissionKey | TeamPermissionKey)[];

const viewerKeySet = new Set<string>(viewerPermissionKeys);

export const rolePermissionMap = {
  OWNER: permissionCatalog.map((permission) => permission.key),
  ADMIN: permissionCatalog
    .filter((permission) => !permission.ownerOnly)
    .map((permission) => permission.key),
  USER: permissionCatalog
    .filter((permission) => viewerKeySet.has(permission.key))
    .map((permission) => permission.key),
} as const satisfies Record<string, readonly PermissionKey[]>;

export type AppRoleName = keyof typeof rolePermissionMap;

export const roleDescriptionMap: Record<AppRoleName, string> = {
  OWNER: 'Dono do tenant com acesso total',
  ADMIN: 'Administrador operacional do tenant',
  USER: 'Usuário padrão do tenant',
};

export const defaultRoleName: AppRoleName = 'USER';

export function isTenantAdminRole(roleName: string): boolean {
  return roleName === 'OWNER' || roleName === 'ADMIN';
}
