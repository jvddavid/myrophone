export type PrismaArgs = Record<string, unknown>;

export interface TenantRecord {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  phone: string;
  avatarUrl: string | null;
  emailVerifiedAt: Date | null;
  passwordHash: string;
  isActive: boolean;
  lastTenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoleRecord {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PermissionRecord {
  id: string;
  key: string;
  description: string | null;
  createdAt: Date;
}

export interface TeamPermissionRecord {
  id: string;
  key: string;
  description: string | null;
  createdAt: Date;
}

export interface TeamRecord {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MembershipRecord {
  id: string;
  tenantId: string;
  userId: string;
  roleId: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMembershipRecord {
  id: string;
  teamId: string;
  membershipId: string;
  role: 'LEADER' | 'MEMBER';
  createdAt: Date;
}

export interface SessionRecord {
  id: string;
  userId: string;
  tenantId: string | null;
  refreshTokenHash: string;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActionLogRecord {
  id: string;
  tenantId: string | null;
  teamId: string | null;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface TeamWithPermissions extends TeamRecord {
  permissions: Array<{
    permission: TeamPermissionRecord;
  }>;
}

export interface MembershipWithRelations extends MembershipRecord {
  tenant: TenantRecord;
  user: UserRecord;
  role: RoleRecord & {
    permissions: Array<{
      permission: PermissionRecord;
    }>;
  };
  permissionGrants?: Array<{
    permissionKey: string;
  }>;
  teams: Array<
    TeamMembershipRecord & {
      team: TeamWithPermissions;
    }
  >;
}

export interface TeamWithCountsAndPermissions extends TeamRecord {
  _count: {
    members: number;
  };
  members: Array<Pick<TeamMembershipRecord, 'id'>>;
  permissions: Array<{
    permission: TeamPermissionRecord;
  }>;
}

export interface SimpleDbDelegate {
  findUnique(args: PrismaArgs): Promise<unknown>;
  findFirst(args: PrismaArgs): Promise<unknown>;
  findMany(args: PrismaArgs): Promise<unknown>;
  create(args: PrismaArgs): Promise<unknown>;
  createMany(args: PrismaArgs): Promise<unknown>;
  upsert(args: PrismaArgs): Promise<unknown>;
  update(args: PrismaArgs): Promise<unknown>;
  updateMany(args: PrismaArgs): Promise<unknown>;
  delete(args: PrismaArgs): Promise<unknown>;
  deleteMany(args: PrismaArgs): Promise<unknown>;
  count(args: PrismaArgs): Promise<unknown>;
}

export interface PrismaDb {
  tenant: SimpleDbDelegate;
  user: SimpleDbDelegate;
  role: SimpleDbDelegate;
  permission: SimpleDbDelegate;
  rolePermission: SimpleDbDelegate;
  membership: SimpleDbDelegate;
  companyPermissionTemplate: SimpleDbDelegate;
  membershipPermissionGrant: SimpleDbDelegate;
  session: SimpleDbDelegate;
  actionLog: SimpleDbDelegate;
  team: SimpleDbDelegate;
  teamPermission: SimpleDbDelegate;
  teamPermissionAssignment: SimpleDbDelegate;
  teamMembership: SimpleDbDelegate;
  storedFile: SimpleDbDelegate;
  emailVerification: SimpleDbDelegate;
  $transaction<T>(fn: (transaction: PrismaDb) => Promise<T>): Promise<T>;
  $disconnect?(): Promise<void>;
}

export function asType<T>(value: unknown): T {
  return value as T;
}
