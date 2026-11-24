import { describe, expect, it } from 'vitest';
import {
  commitMemberSearch,
  memberSearchDebounceMs,
  memberSearchIsCurrent,
  runMemberSearch,
} from './member-search';

describe('member search', () => {
  it('resets the page only when the committed term changes', () => {
    expect(memberSearchDebounceMs).toBe(3000);
    expect(commitMemberSearch('ana', ' ana ')).toEqual({
      term: 'ana',
      changed: false,
    });
    expect(commitMemberSearch('ana', 'beatriz')).toEqual({
      term: 'beatriz',
      changed: true,
    });
  });

  it('ignores a response that belongs to an older query', async () => {
    let resolve: ((value: string) => void) | undefined;
    const request = new Promise<string>((done) => {
      resolve = done;
    });
    const current = { term: 'a', page: 1 };
    const pending = runMemberSearch(
      { term: 'a', page: 1 },
      () => current,
      new AbortController().signal,
      request,
    );

    current.term = 'ab';
    resolve?.('stale');

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await expect(
      runMemberSearch(
        { term: 'ab', page: 1 },
        () => current,
        new AbortController().signal,
        Promise.resolve('current'),
      ),
    ).resolves.toBe('current');
    expect(memberSearchIsCurrent({ term: 'ab', page: 2 }, current)).toBe(false);
  });
});
