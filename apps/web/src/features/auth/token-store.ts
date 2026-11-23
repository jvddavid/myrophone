const storageKey = 'myrophone.session';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

function isStoredTokens(value: unknown): value is StoredTokens {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.accessToken === 'string' &&
    record.accessToken.length > 0 &&
    typeof record.refreshToken === 'string' &&
    record.refreshToken.length >= 10
  );
}

export function readTokens(): StoredTokens | null {
  try {
    const raw = localStorage.getItem(storageKey);

    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    return isStoredTokens(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function readAccessToken(): string | null {
  return readTokens()?.accessToken ?? null;
}

export function writeTokens(tokens: StoredTokens): void {
  localStorage.setItem(storageKey, JSON.stringify(tokens));
}

export function clearTokens(): void {
  localStorage.removeItem(storageKey);
}
