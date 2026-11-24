export const memberSearchDebounceMs = 3000;

export interface MemberSearchSnapshot {
  term: string;
  page: number;
}

export function commitMemberSearch(
  currentTerm: string,
  value: string,
): { term: string; changed: boolean } {
  const term = value.trim();
  return { term, changed: term !== currentTerm };
}

export function memberSearchIsCurrent(
  started: MemberSearchSnapshot,
  current: MemberSearchSnapshot,
): boolean {
  return started.term === current.term && started.page === current.page;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function memberSearchRetry(failureCount: number, error: unknown): boolean {
  if (isAbortError(error)) {
    return false;
  }

  return failureCount < 1;
}

export async function runMemberSearch<T>(
  started: MemberSearchSnapshot,
  current: () => MemberSearchSnapshot,
  signal: AbortSignal,
  request: Promise<T>,
): Promise<T> {
  try {
    const result = await request;

    if (signal.aborted || !memberSearchIsCurrent(started, current())) {
      throw new DOMException('Aborted', 'AbortError');
    }

    return result;
  } catch (error) {
    if (isAbortError(error) || signal.aborted || !memberSearchIsCurrent(started, current())) {
      throw new DOMException('Aborted', 'AbortError');
    }

    throw error;
  }
}
