import { logoutRequest, profileRequest } from './api';
import { abandonSessionRenewal, noteAccessToken } from './session-renewal';
import { clearTokens, readTokens, writeTokens } from './token-store';
import type { AuthProfile, AuthSession } from './types';

function persistSession(session: AuthSession): void {
  writeTokens({
    accessToken: session.tokens.accessToken,
    refreshToken: session.tokens.refreshToken,
  });
  noteAccessToken(session.tokens.accessToken);
}

export function saveSession(session: AuthSession): void {
  persistSession(session);
}

let pendingSession: Promise<AuthProfile | null> | null = null;

async function loadSession(): Promise<AuthProfile | null> {
  if (!readTokens()) {
    return null;
  }

  const profile = await profileRequest();

  if (profile === 'unauthorized') {
    clearTokens();
    abandonSessionRenewal();
    return null;
  }

  const tokens = readTokens();

  if (tokens) {
    noteAccessToken(tokens.accessToken);
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
  abandonSessionRenewal();
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
