import { getApi } from '../../api/client';
import { accessErrorMessage } from './messages';

export class AccessRequestError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AccessRequestError';
    this.code = code;
  }
}

export interface CompanyTeam {
  id: string;
  name: string;
  slug: string;
}

export interface CompanyMember {
  userId: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  role: string;
  team: CompanyTeam | null;
  teams: CompanyTeam[];
}

export interface MemberListParams {
  q?: string;
  page?: number;
  pageSize?: number;
  unassigned?: boolean;
}

export interface MemberListPage {
  members: CompanyMember[];
  page: number;
  pageSize: number;
  total: number;
}

export const memberPageSize = 20;

export interface OwnedCompany {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  teams: CompanyTeam[];
}

export interface TeamSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  isActive: boolean;
  memberCount: number;
  leaderCount: number;
  permissionKeys: string[];
}

export interface CreateAccessBody {
  name: string;
  phone: string;
  email: string;
  password: string;
  companies: Array<{ tenantId: string; teamId: string }>;
}

interface TreatyResult {
  data: unknown;
  error: unknown;
}

interface AccessRoutes {
  companies: {
    members: {
      get(options?: { query?: Record<string, string> }): Promise<TreatyResult>;
      post(body: CreateAccessBody): Promise<TreatyResult>;
      invite: {
        post(body: { email: string }): Promise<TreatyResult>;
      };
      (params: { userId: string }): {
        delete(): Promise<TreatyResult>;
        team: {
          put(body: { teamId: string }): Promise<TreatyResult>;
        };
      };
    };
    owned: {
      get(): Promise<TreatyResult>;
    };
  };
  teams: {
    get(): Promise<TreatyResult>;
    post(body: {
      name: string;
      description?: string;
      icon?: string;
    }): Promise<TreatyResult>;
    (params: { teamId: string }): {
      patch(body: {
        name: string;
        description?: string | null;
        icon?: string;
      }): Promise<TreatyResult>;
      members: {
        get(options?: { query?: Record<string, string> }): Promise<TreatyResult>;
        post(body: { userId: string }): Promise<TreatyResult>;
        (params: { userId: string }): {
          delete(): Promise<TreatyResult>;
        };
      };
      candidates: {
        get(options?: { query?: Record<string, string> }): Promise<TreatyResult>;
      };
    };
  };
}

function incompleteResponse(): AccessRequestError {
  return new AccessRequestError(
    'INVALID_RESPONSE',
    'A API devolveu uma resposta incompleta.',
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function accessRoutes(): AccessRoutes {
  return getApi() as unknown as AccessRoutes;
}

export function accessErrorCode(error: unknown): string {
  if (error instanceof AccessRequestError) {
    return error.code;
  }

  if (!isRecord(error) || !isRecord(error.value)) {
    return 'UNKNOWN';
  }

  return typeof error.value.error === 'string' ? error.value.error : 'UNKNOWN';
}

export function accessFailureText(error: unknown): string {
  if (error instanceof AccessRequestError && error.code === 'INVALID_RESPONSE') {
    return error.message;
  }

  const code = error instanceof AccessRequestError ? error.code : accessErrorCode(error);
  return accessErrorMessage(code);
}

function throwResponseError(error: unknown): void {
  if (!error) {
    return;
  }

  const code = accessErrorCode(error);
  throw new AccessRequestError(code, accessErrorMessage(code));
}

function isTeam(value: unknown): value is CompanyTeam {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.slug === 'string'
  );
}

function isMember(value: unknown): value is CompanyMember {
  return (
    isRecord(value) &&
    typeof value.userId === 'string' &&
    typeof value.name === 'string' &&
    typeof value.email === 'string' &&
    typeof value.phone === 'string' &&
    (value.avatarUrl === null || typeof value.avatarUrl === 'string') &&
    typeof value.role === 'string' &&
    (value.team === null || isTeam(value.team)) &&
    Array.isArray(value.teams) &&
    value.teams.every(isTeam)
  );
}

function isOwnedCompany(value: unknown): value is OwnedCompany {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.slug === 'string' &&
    typeof value.name === 'string' &&
    (value.description === null || typeof value.description === 'string') &&
    (value.logoUrl === null || typeof value.logoUrl === 'string') &&
    Array.isArray(value.teams) &&
    value.teams.every(isTeam)
  );
}

function isTeamSummary(value: unknown): value is TeamSummary {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.slug === 'string' &&
    typeof value.name === 'string' &&
    (value.description === null || typeof value.description === 'string') &&
    typeof value.icon === 'string' &&
    typeof value.isActive === 'boolean' &&
    typeof value.memberCount === 'number' &&
    typeof value.leaderCount === 'number' &&
    Array.isArray(value.permissionKeys) &&
    value.permissionKeys.every((key) => typeof key === 'string')
  );
}

function readItems<T>(
  data: unknown,
  isItem: (value: unknown) => value is T,
): T[] {
  if (!isRecord(data) || !Array.isArray(data.items) || !data.items.every(isItem)) {
    throw incompleteResponse();
  }

  return data.items;
}

export function memberListQuery(input: MemberListParams): Record<string, string> {
  const query: Record<string, string> = {
    page: String(input.page ?? 1),
    pageSize: String(input.pageSize ?? memberPageSize),
    q: input.q?.trim() ?? '',
  };

  if (input.unassigned) {
    query.unassigned = '1';
  }

  return query;
}

function readMemberPage(data: unknown): MemberListPage {
  if (
    !isRecord(data) ||
    !Array.isArray(data.members) ||
    !data.members.every(isMember) ||
    typeof data.page !== 'number' ||
    typeof data.pageSize !== 'number' ||
    typeof data.total !== 'number'
  ) {
    throw incompleteResponse();
  }

  return {
    members: data.members,
    page: data.page,
    pageSize: data.pageSize,
    total: data.total,
  };
}

export async function listMembersRequest(
  params: MemberListParams = {},
): Promise<MemberListPage> {
  const { data, error } = await accessRoutes().companies.members.get({
    query: memberListQuery(params),
  });
  throwResponseError(error);
  return readMemberPage(data);
}

export async function listTeamMembersRequest(
  teamId: string,
  params: MemberListParams = {},
): Promise<MemberListPage> {
  const { data, error } = await accessRoutes()
    .teams({ teamId })
    .members.get({ query: memberListQuery(params) });
  throwResponseError(error);
  return readMemberPage(data);
}

export async function listTeamCandidatesRequest(
  teamId: string,
  params: MemberListParams = {},
): Promise<MemberListPage> {
  const { data, error } = await accessRoutes()
    .teams({ teamId })
    .candidates.get({ query: memberListQuery(params) });
  throwResponseError(error);
  return readMemberPage(data);
}

export async function inviteMemberRequest(email: string): Promise<{
  userId: string;
  email: string;
  name: string;
  role: string;
  membershipId: string;
}> {
  const { data, error } = await accessRoutes().companies.members.invite.post({
    email,
  });
  throwResponseError(error);

  if (
    !isRecord(data) ||
    typeof data.userId !== 'string' ||
    typeof data.email !== 'string' ||
    typeof data.name !== 'string' ||
    typeof data.role !== 'string' ||
    typeof data.membershipId !== 'string'
  ) {
    throw incompleteResponse();
  }

  return {
    userId: data.userId,
    email: data.email,
    name: data.name,
    role: data.role,
    membershipId: data.membershipId,
  };
}

export async function removeMemberRequest(userId: string): Promise<{ removed: true }> {
  const { data, error } = await accessRoutes().companies.members({ userId }).delete();
  throwResponseError(error);

  if (!isRecord(data) || data.removed !== true) {
    throw incompleteResponse();
  }

  return { removed: true };
}

export async function listOwnedCompaniesRequest(): Promise<OwnedCompany[]> {
  const { data, error } = await accessRoutes().companies.owned.get();
  throwResponseError(error);
  return readItems(data, isOwnedCompany);
}

export async function createMemberRequest(body: CreateAccessBody): Promise<{
  user: { id: string; name: string; email: string; phone: string };
  memberships: Array<{
    tenantId: string;
    membershipId: string;
    role: string;
    team: CompanyTeam;
  }>;
}> {
  const { data, error } = await accessRoutes().companies.members.post(body);
  throwResponseError(error);

  if (!isRecord(data) || !isRecord(data.user) || !Array.isArray(data.memberships)) {
    throw incompleteResponse();
  }

  const user = data.user;

  if (
    typeof user.id !== 'string' ||
    typeof user.name !== 'string' ||
    typeof user.email !== 'string' ||
    typeof user.phone !== 'string'
  ) {
    throw incompleteResponse();
  }

  const memberships = data.memberships.map((membership) => {
    if (
      !isRecord(membership) ||
      typeof membership.tenantId !== 'string' ||
      typeof membership.membershipId !== 'string' ||
      typeof membership.role !== 'string' ||
      !isTeam(membership.team)
    ) {
      throw incompleteResponse();
    }

    return {
      tenantId: membership.tenantId,
      membershipId: membership.membershipId,
      role: membership.role,
      team: membership.team,
    };
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
    },
    memberships,
  };
}

export async function listTeamsRequest(): Promise<TeamSummary[]> {
  const { data, error } = await accessRoutes().teams.get();
  throwResponseError(error);
  return readItems(data, isTeamSummary);
}

export async function assignTeamRequest(
  userId: string,
  teamId: string,
): Promise<{ userId: string; teamId: string; role: string }> {
  const { data, error } = await accessRoutes()
    .companies.members({ userId })
    .team.put({ teamId });
  throwResponseError(error);

  if (
    !isRecord(data) ||
    typeof data.userId !== 'string' ||
    typeof data.teamId !== 'string' ||
    typeof data.role !== 'string'
  ) {
    throw incompleteResponse();
  }

  return { userId: data.userId, teamId: data.teamId, role: data.role };
}

export async function createTeamRequest(body: {
  name: string;
  description?: string;
  icon?: string;
}): Promise<{ id: string; name: string }> {
  const { data, error } = await accessRoutes().teams.post(body);
  throwResponseError(error);

  if (!isRecord(data) || typeof data.id !== 'string' || typeof data.name !== 'string') {
    throw incompleteResponse();
  }

  return { id: data.id, name: data.name };
}

export async function updateTeamRequest(
  teamId: string,
  body: { name: string; description: string | null; icon?: string },
): Promise<{ id: string; name: string; description: string | null }> {
  const { data, error } = await accessRoutes().teams({ teamId }).patch(body);
  throwResponseError(error);

  if (
    !isRecord(data) ||
    typeof data.id !== 'string' ||
    typeof data.name !== 'string' ||
    !(data.description === null || typeof data.description === 'string')
  ) {
    throw incompleteResponse();
  }

  return {
    id: data.id,
    name: data.name,
    description: data.description,
  };
}

export async function addTeamMemberRequest(
  teamId: string,
  userId: string,
): Promise<{ userId: string; teamId: string }> {
  const { data, error } = await accessRoutes()
    .teams({ teamId })
    .members.post({ userId });
  throwResponseError(error);

  if (
    !isRecord(data) ||
    typeof data.userId !== 'string' ||
    typeof data.teamId !== 'string'
  ) {
    throw incompleteResponse();
  }

  return { userId: data.userId, teamId: data.teamId };
}

export async function removeTeamMemberRequest(
  teamId: string,
  userId: string,
): Promise<{ removed: true }> {
  const { data, error } = await accessRoutes()
    .teams({ teamId })
    .members({ userId })
    .delete();
  throwResponseError(error);

  if (!isRecord(data) || data.removed !== true) {
    throw incompleteResponse();
  }

  return { removed: true };
}
