export function groupMembersByTeam<
  T extends { teams: ReadonlyArray<{ id: string }> },
>(members: readonly T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const member of members) {
    for (const team of member.teams) {
      const current = grouped.get(team.id);

      if (current) {
        current.push(member);
      } else {
        grouped.set(team.id, [member]);
      }
    }
  }

  return grouped;
}

export function membersOfTeam<
  T extends { teams: ReadonlyArray<{ id: string }> },
>(members: readonly T[], teamId: string): T[] {
  return groupMembersByTeam(members).get(teamId) ?? [];
}

export function unassignedMembers<
  T extends { teams: ReadonlyArray<{ id: string }> },
>(members: readonly T[], activeTeamIds: ReadonlySet<string>): T[] {
  const unassigned: T[] = [];

  for (const member of members) {
    let listed = false;

    for (const team of member.teams) {
      if (activeTeamIds.has(team.id)) {
        listed = true;
        break;
      }
    }

    if (!listed) {
      unassigned.push(member);
    }
  }

  return unassigned;
}

export function membersOutsideTeam<T extends { userId: string }>(
  members: readonly T[],
  memberIdsInTeam: ReadonlySet<string>,
): T[] {
  const outside: T[] = [];

  for (const member of members) {
    if (!memberIdsInTeam.has(member.userId)) {
      outside.push(member);
    }
  }

  return outside;
}
