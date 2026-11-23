import { logoutRequest, profileRequest, refreshRequest } from './api';
import { clearTokens, readTokens, writeTokens } from './token-store';
import type { AuthProfile, AuthSession } from './types';

function persistSession(session: AuthSession): void {
  writeTokens({
    accessToken: session.tokens.accessToken,
    refreshToken: session.tokens.refreshToken,
  });
}

export function saveSession(session: AuthSession): void {
  persistSession(session);
}

let pendingSession: Promise<AuthProfile | null> | null = null;

async function refreshStoredSession(): Promise<boolean> {
  const tokens = readTokens();

  if (!tokens) {
    return false;
  }

  try {
    persistSession(await refreshRequest(tokens.refreshToken));
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

async function loadSession(): Promise<AuthProfile | null> {
  if (!readTokens()) {
    return null;
  }

  let profile = await profileRequest();

  if (profile === 'unauthorized') {
    const refreshed = await refreshStoredSession();

    if (!refreshed) {
      return null;
    }

    profile = await profileRequest();
  }

  if (profile === 'unauthorized') {
    clearTokens();
    return null;
  }

  return profile;
}

export function ensureSession(): Promise<AuthProfile | null> {
  pendingSession ??= loadSession().finally(() => {
    pendingSession = null;
  });

  return pendingSession;
}

export async function logoutSession(): Promise<void> {
  const tokens = readTokens();
  clearTokens();

  if (!tokens) {
    return;
  }

  try {
    await logoutRequest(tokens.refreshToken);
  } catch {
    return;
  }
}
