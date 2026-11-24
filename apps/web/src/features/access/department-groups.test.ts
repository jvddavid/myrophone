import { describe, expect, it } from 'vitest';
import {
  groupMembersByTeam,
  membersOfTeam,
  membersOutsideTeam,
  unassignedMembers,
} from './department-groups';

const ana = {
  userId: 'ana',
  teams: [{ id: 'geral' }, { id: 'fiscal' }],
};
const members = [
  ana,
  { userId: 'bia', teams: [{ id: 'geral' }] },
  { userId: 'caio', teams: [] },
  { userId: 'davi', teams: [{ id: 'inativo' }] },
];

describe('department groups', () => {
  it('repeats a person inside every department they belong to', () => {
    const grouped = groupMembersByTeam(members);

    expect(grouped.get('geral')?.map((member) => member.userId)).toEqual([
      'ana',
      'bia',
    ]);
    expect(grouped.get('fiscal')?.map((member) => member.userId)).toEqual([
      'ana',
    ]);
    expect(grouped.get('geral')?.[0]).toBe(ana);
    expect(grouped.get('fiscal')?.[0]).toBe(ana);
    expect(membersOfTeam(members, 'fiscal').map((member) => member.userId)).toEqual([
      'ana',
    ]);
  });

  it('returns people without an active department', () => {
    expect(
      unassignedMembers(members, new Set(['geral', 'fiscal'])).map(
        (member) => member.userId,
      ),
    ).toEqual(['caio', 'davi']);
  });

  it('lists company members who are not in the department', () => {
    expect(
      membersOutsideTeam(members, new Set(['ana', 'bia'])).map(
        (member) => member.userId,
      ),
    ).toEqual(['caio', 'davi']);
  });
});
