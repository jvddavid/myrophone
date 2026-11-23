export const permissionCatalog = [
  { key: 'tenant.read', description: 'Ler dados do tenant atual' },
  { key: 'tenant.manage', description: 'Gerenciar configurações do tenant' },
  { key: 'users.read', description: 'Listar usuários do tenant' },
  {
    key: 'users.manage',
    description: 'Criar/editar/remover usuários do tenant',
  },
  { key: 'teams.read', description: 'Listar departamentos/times do tenant' },
  { key: 'teams.manage', description: 'Criar e editar times/departamentos' },
  {
    key: 'teams.members.manage',
    description: 'Gerenciar membros dos times/departamentos',
  },
  { key: 'permissions.read', description: 'Visualizar permissões e papéis' },
  { key: 'permissions.manage', description: 'Gerenciar papéis e permissões' },
  { key: 'logs.read', description: 'Ler action logs do tenant' },
] as const;

export const teamPermissionCatalog = [
  { key: 'dashboard.view', description: 'Acesso ao dashboard principal' },
  { key: 'management.view', description: 'Acesso às telas de gestão' },
  { key: 'deliveries.view', description: 'Acesso às telas de entregas' },
  { key: 'sales.view', description: 'Acesso às telas de vendas' },
  { key: 'support.view', description: 'Acesso às telas de atendimento' },
  { key: 'reports.view', description: 'Acesso às telas de relatórios' },
] as const;

export type PermissionKey = (typeof permissionCatalog)[number]['key'];
export type TeamPermissionKey = (typeof teamPermissionCatalog)[number]['key'];

export const rolePermissionMap = {
  OWNER: permissionCatalog.map((permission) => permission.key),
  ADMIN: [
    'tenant.read',
    'tenant.manage',
    'users.read',
    'users.manage',
    'teams.read',
    'teams.manage',
    'teams.members.manage',
    'permissions.read',
    'logs.read',
  ],
  USER: ['tenant.read', 'users.read', 'teams.read'],
} as const satisfies Record<string, PermissionKey[]>;

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
