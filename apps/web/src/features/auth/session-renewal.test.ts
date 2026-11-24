import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createSessionFetch,
  readJwtExpiryMs,
  refreshDelayMs,
  refreshLeadMs,
  type SessionFetchController,
} from './session-renewal';
import type { StoredTokens } from './token-store';

const refreshToken = 'refresh-token-123';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function jwtWithExp(expSeconds: number): string {
  const payload = Buffer.from(JSON.stringify({ exp: expSeconds })).toString('base64url');
  return `header.${payload}.signature`;
}

function authorization(init?: RequestInit): string | null {
  return new Headers(init?.headers).get('authorization');
}

describe('session renewal', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries once after a 401 and stores the refreshed tokens', async () => {
    const store: StoredTokens = {
      accessToken: 'expired-access',
      refreshToken,
    };
    const calls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(url);

      if (url.endsWith('/auth/refresh')) {
        expect(init?.method).toBe('POST');
        expect(url).not.toContain(refreshToken);
        expect(JSON.parse(String(init?.body))).toEqual({ refreshToken });
        return json(200, {
          tokens: {
            accessToken: 'fresh-access',
            refreshToken: 'rotated-refresh-token',
          },
        });
      }

      if (authorization(init) === 'Bearer expired-access') {
        return json(401, { error: 'UNAUTHORIZED' });
      }

      expect(authorization(init)).toBe('Bearer fresh-access');
      return json(200, { ok: true });
    });
    const session = createHarness(fetchMock, store);
    const response = await session.fetch('http://api.test/companies/members', {
      headers: { authorization: 'Bearer expired-access' },
    });

    expect(response.status).toBe(200);
    expect(store).toEqual({
      accessToken: 'fresh-access',
      refreshToken: 'rotated-refresh-token',
    });
    expect(calls.filter((url) => url.endsWith('/auth/refresh'))).toHaveLength(1);
    expect(calls.filter((url) => url.endsWith('/companies/members'))).toHaveLength(2);
  });

  it('clears the session when refresh fails and does not retry', async () => {
    const store: StoredTokens = {
      accessToken: 'expired-access',
      refreshToken,
    };
    let cleared = false;
    let lost = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith('/auth/refresh')) {
        return json(401, { error: 'INVALID_REFRESH_TOKEN' });
      }

      return json(401, { error: 'UNAUTHORIZED' });
    });
    const session = createSessionFetch({
      fetch: fetchMock,
      readTokens: () => (store.refreshToken ? store : null),
      writeTokens: (next) => {
        store.accessToken = next.accessToken;
        store.refreshToken = next.refreshToken;
      },
      clearTokens: () => {
        cleared = true;
        store.accessToken = '';
        store.refreshToken = '';
      },
      apiBaseUrl: () => 'http://api.test',
      onLost: () => {
        lost += 1;
      },
    });
    const response = await session.fetch('http://api.test/companies/members', {
      headers: { authorization: 'Bearer expired-access' },
    });

    expect(response.status).toBe(401);
    expect(cleared).toBe(true);
    expect(lost).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(store.refreshToken).toBe('');

    await session.fetch('http://api.test/companies/members', {
      headers: { authorization: 'Bearer expired-access' },
    });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh'))).toHaveLength(1);
  });

  it('shares one refresh across parallel 401s', async () => {
    const store: StoredTokens = {
      accessToken: 'expired-access',
      refreshToken,
    };
    let releaseRefresh: (() => void) | undefined;
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    let refreshCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith('/auth/refresh')) {
        refreshCalls += 1;
        await refreshGate;
        return json(200, {
          tokens: {
            accessToken: 'fresh-access',
            refreshToken,
          },
        });
      }

      if (authorization(init) === 'Bearer fresh-access') {
        return json(200, { ok: true });
      }

      return json(401, { error: 'UNAUTHORIZED' });
    });
    const session = createHarness(fetchMock, store);
    const first = session.fetch('http://api.test/companies/members', {
      headers: { authorization: 'Bearer expired-access' },
    });
    const second = session.fetch('http://api.test/companies/members', {
      headers: { authorization: 'Bearer expired-access' },
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(refreshCalls).toBe(1);
    releaseRefresh?.();

    const responses = await Promise.all([first, second]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(refreshCalls).toBe(1);
  });

  it('refreshes about 60 seconds before the access token expires', async () => {
    vi.useFakeTimers();
    const now = 1_700_000_000_000;
    const expSeconds = Math.floor((now + 90_000) / 1000);
    const accessToken = jwtWithExp(expSeconds);
    const store: StoredTokens = { accessToken, refreshToken };
    let refreshCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/refresh')) {
        refreshCalls += 1;
        return json(200, {
          tokens: {
            accessToken: jwtWithExp(expSeconds + 900),
            refreshToken: 'rotated-refresh-token',
          },
        });
      }

      return json(200, { ok: true });
    });
    const session = createSessionFetch({
      fetch: fetchMock,
      readTokens: () => store,
      writeTokens: (next) => {
        store.accessToken = next.accessToken;
        store.refreshToken = next.refreshToken;
      },
      clearTokens: () => undefined,
      apiBaseUrl: () => 'http://api.test',
      onLost: () => undefined,
      now: () => now,
    });

    expect(readJwtExpiryMs(accessToken)).toBe(expSeconds * 1000);
    expect(refreshDelayMs(expSeconds * 1000, now)).toBe(90_000 - refreshLeadMs);
    expect(readJwtExpiryMs('not-a-jwt')).toBeNull();

    session.noteAccessToken(accessToken);
    await vi.advanceTimersByTimeAsync(29_000);
    expect(refreshCalls).toBe(0);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(refreshCalls).toBe(1);
    expect(store.refreshToken).toBe('rotated-refresh-token');
  });
});

function createHarness(
  fetchMock: SessionFetchController['fetch'],
  store: StoredTokens,
): SessionFetchController {
  return createSessionFetch({
    fetch: fetchMock,
    readTokens: () => (store.accessToken && store.refreshToken ? { ...store } : null),
    writeTokens: (next) => {
      store.accessToken = next.accessToken;
      store.refreshToken = next.refreshToken;
    },
    clearTokens: () => {
      store.accessToken = '';
      store.refreshToken = '';
    },
    apiBaseUrl: () => 'http://api.test',
    onLost: () => undefined,
  });
}
