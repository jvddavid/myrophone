export const hierarchyExportStepCatalog = [
  'validating_input',
  'building_graph',
  'rendering_pdf',
  'finalizing',
] as const;

export type HierarchyExportStep = (typeof hierarchyExportStepCatalog)[number];

export type HierarchyUserRole = 'OWNER' | 'ADMIN' | 'USER';
export type HierarchyTeamMembershipRole = 'LEADER' | 'MEMBER';

export interface TenantHierarchyTeamSnapshot {
  id: string;
  slug: string;
  name: string;
  memberCount: number;
}

export interface TenantHierarchyUserSnapshot {
  userId: string;
  email: string;
  name: string | null;
  tenantRole: HierarchyUserRole;
  avatarUrl: string;
  teamRoles: Array<{
    teamId: string;
    role: HierarchyTeamMembershipRole;
  }>;
}

export interface TenantHierarchyEdge {
  from: string;
  to: string;
  relation: 'tenant_role' | 'team_member';
  label: string;
}

export interface TenantHierarchySnapshot {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  users: TenantHierarchyUserSnapshot[];
  teams: TenantHierarchyTeamSnapshot[];
  edges: TenantHierarchyEdge[];
  generatedAt: string;
}

export interface TenantHierarchyExportJobData {
  requestId: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  requestedByUserId: string;
  requestedAt: string;
  snapshot: TenantHierarchySnapshot;
}

export type HierarchyExportJobState =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed';

export interface HierarchyExportProgress {
  status: HierarchyExportJobState;
  step: HierarchyExportStep;
  completedSteps: HierarchyExportStep[];
  percent: number;
  message: string;
  startedAt: string;
  updatedAt: string;
}

export interface TenantHierarchyExportResult {
  format: 'pdf';
  fileName: string;
  mimeType: 'application/pdf';
  contentBase64: string;
  sizeBytes: number;
  generatedAt: string;
  tenantId: string;
  steps: HierarchyExportStep[];
}
