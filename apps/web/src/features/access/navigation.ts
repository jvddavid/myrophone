export type SidebarDestination = 'panel' | 'access' | 'departments';

export function sidebarDestinations(input: {
  permissions: readonly string[];
  teamPermissions: readonly string[];
}): SidebarDestination[] {
  const permissions = new Set(input.permissions);
  const screens = new Set(input.teamPermissions);
  const destinations: SidebarDestination[] = [];

  if (screens.has('dashboard.view')) {
    destinations.push('panel');
  }

  if (permissions.has('users.read')) {
    destinations.push('access');
  }

  if (permissions.has('teams.read')) {
    destinations.push('departments');
  }

  return destinations;
}

export function canViewPanel(teamPermissions: readonly string[]): boolean {
  return teamPermissions.includes('dashboard.view');
}

export function canReadPeople(permissions: readonly string[]): boolean {
  return permissions.includes('users.read');
}

export function canManagePeople(permissions: readonly string[]): boolean {
  return permissions.includes('users.manage');
}

export function canEditPermissions(permissions: readonly string[]): boolean {
  return permissions.includes('permissions.manage');
}

export function canReadDepartments(permissions: readonly string[]): boolean {
  return permissions.includes('teams.read');
}

export function canManageDepartments(permissions: readonly string[]): boolean {
  return permissions.includes('teams.manage');
}

export function canManageDepartmentPeople(
  permissions: readonly string[],
): boolean {
  return permissions.includes('teams.members.manage');
}

export function canRemoveMember(
  role: string,
  permissions: readonly string[],
): boolean {
  if (!canManagePeople(permissions)) {
    return false;
  }

  if (role === 'OWNER') {
    return canEditPermissions(permissions);
  }

  return true;
}
