import { apiBaseUrl } from '../../api/base-url';
import { clearTokens, readTokens, writeTokens, type StoredTokens } from './token-store';

export const refreshLeadMs = 60_000;

const unrenewablePaths = ['/auth/refresh', '/auth/logout', '/auth/login', '/auth/register'];

export interface SessionFetchDeps {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  readTokens: () => StoredTokens | null;
  writeTokens: (tokens: StoredTokens) => void;
  clearTokens: () => void;
  apiBaseUrl: () => string;
  onLost: () => void;
  now?: () => number;
}

export interface SessionFetchController {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  noteAccessToken: (accessToken: string) => void;
  abandon: () => void;
  renew: () => Promise<boolean>;
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const remainder = normalized.length % 4;
  const padded = remainder === 0 ? normalized : normalized + '='.repeat(4 - remainder);
  return atob(padded);
}

export function readJwtExpiryMs(token: string): number | null {
  const segment = token.split('.')[1];

  if (!segment) {
    return null;
  }

  try {
    const payload: unknown = JSON.parse(decodeBase64Url(segment));

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null;
    }

    const exp = (payload as { exp?: unknown }).exp;

    if (typeof exp !== 'number' || !Number.isFinite(exp)) {
      return null;
    }

    return exp * 1000;
  } catch {
    return null;
  }
}

export function refreshDelayMs(
  expiryMs: number,
  nowMs: number,
  leadMs = refreshLeadMs,
): number {
  return Math.max(0, expiryMs - leadMs - nowMs);
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }

  if (input instanceof URL) {
    return input.href;
  }

  return input.url;
}

function pathnameOf(url: string): string | null {
  try {
    return new URL(url).pathname;
  } catch {
    return null;
  }
}

function skipsRenewal(url: string): boolean {
  const pathname = pathnameOf(url);

  if (!pathname) {
    return false;
  }

  return unrenewablePaths.some((path) => pathname.endsWith(path));
}

function bearerFrom(init: RequestInit | undefined, input: RequestInfo | URL): string | null {
  const fromInit = init?.headers ? new Headers(init.headers).get('authorization') : null;
  const fromRequest = input instanceof Request ? input.headers.get('authorization') : null;
  const value = fromInit ?? fromRequest;

  if (!value?.startsWith('Bearer ')) {
    return null;
  }

  const token = value.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

function readRefreshTokens(body: unknown): StoredTokens | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }

  const tokens = (body as { tokens?: unknown }).tokens;

  if (!tokens || typeof tokens !== 'object' || Array.isArray(tokens)) {
    return null;
  }

  const accessToken = (tokens as { accessToken?: unknown }).accessToken;
  const refreshToken = (tokens as { refreshToken?: unknown }).refreshToken;

  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    return null;
  }

  if (typeof refreshToken !== 'string' || refreshToken.length < 10) {
    return null;
  }

  return { accessToken, refreshToken };
}

function renewedBody(
  body: BodyInit | null | undefined,
  refreshToken: string,
): BodyInit | null | undefined {
  if (typeof body !== 'string') {
    return body;
  }

  try {
    const parsed: unknown = JSON.parse(body);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return body;
    }

    if (!Object.hasOwn(parsed, 'refreshToken')) {
      return body;
    }

    return JSON.stringify({ ...parsed, refreshToken });
  } catch {
    return body;
  }
}

function withStoredSession(init: RequestInit | undefined, tokens: StoredTokens): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set('authorization', `Bearer ${tokens.accessToken}`);

  return {
    ...init,
    headers,
    body: renewedBody(init?.body, tokens.refreshToken),
  };
}

export function createSessionFetch(deps: SessionFetchDeps): SessionFetchController {
  let generation = 0;
  let pending: Promise<boolean> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function now(): number {
    return deps.now?.() ?? Date.now();
  }

  function cancelTimer(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function noteAccessToken(accessToken: string): void {
    cancelTimer();
    const expiryMs = readJwtExpiryMs(accessToken);

    if (expiryMs === null) {
      return;
    }

    const scheduledGeneration = generation;
    const delay = refreshDelayMs(expiryMs, now());
    timer = setTimeout(() => {
      if (scheduledGeneration !== generation) {
        return;
      }

      void refreshShared();
    }, delay);
  }

  function loseSession(current: number): void {
    if (current !== generation) {
      return;
    }

    generation += 1;
    cancelTimer();
    deps.clearTokens();
    deps.onLost();
  }

  async function runRefresh(current: number): Promise<boolean> {
    const tokens = deps.readTokens();

    if (!tokens) {
      loseSession(current);
      return false;
    }

    let response: Response;

    try {
      response = await deps.fetch(`${deps.apiBaseUrl()}/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });
    } catch {
      loseSession(current);
      return false;
    }

    if (current !== generation) {
      return false;
    }

    if (!response.ok) {
      loseSession(current);
      return false;
    }

    const body: unknown = await response.json().catch(() => null);
    const next = readRefreshTokens(body);

    if (current !== generation) {
      return false;
    }

    if (!next) {
      loseSession(current);
      return false;
    }

    deps.writeTokens(next);
    noteAccessToken(next.accessToken);
    return true;
  }

  function refreshShared(): Promise<boolean> {
    if (pending) {
      return pending;
    }

    const current = generation;
    pending = runRefresh(current).finally(() => {
      pending = null;
    });
    return pending;
  }

  async function fetchWithRenewal(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const response = await deps.fetch(input, init);

    if (response.status !== 401 || !bearerFrom(init, input) || skipsRenewal(requestUrl(input))) {
      return response;
    }

    const renewed = await refreshShared();

    if (!renewed) {
      return response;
    }

    const tokens = deps.readTokens();

    if (!tokens) {
      return response;
    }

    return deps.fetch(input, withStoredSession(init, tokens));
  }

  return {
    fetch: fetchWithRenewal,
    noteAccessToken,
    abandon() {
      generation += 1;
      cancelTimer();
    },
    renew: refreshShared,
  };
}

let sessionLostHandler: (() => void) | null = null;

const appSession = createSessionFetch({
  fetch: (input, init) => globalThis.fetch(input, init),
  readTokens,
  writeTokens,
  clearTokens,
  apiBaseUrl,
  onLost() {
    sessionLostHandler?.();
  },
});

export function setSessionLostHandler(handler: () => void): void {
  sessionLostHandler = handler;
}

export function sessionFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return appSession.fetch(input, init);
}

export function noteAccessToken(accessToken: string): void {
  appSession.noteAccessToken(accessToken);
}

export function abandonSessionRenewal(): void {
  appSession.abandon();
}
