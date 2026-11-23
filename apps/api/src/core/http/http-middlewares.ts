import * as Sentry from '@sentry/elysia';
import { Elysia } from 'elysia';
import { env } from '../config/env';
import { AppError } from '../errors/app-error';
import { logger } from '../logger';

const requestStartedAt = new WeakMap<Request, number>();
const requestIds = new WeakMap<Request, string>();

const securityHeaders = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'x-xss-protection': '0',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'cache-control': 'no-store',
} as const;

interface ValidationIssue {
  field: string;
  reason: string;
  expected?: unknown;
  received?: unknown;
}

interface ValidationDetails {
  source: string;
  summary: string;
  issues: ValidationIssue[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function normalizeValidationField(
  source: string,
  value: unknown,
): string | null {
  const rawPath = asString(value);

  if (!rawPath) {
    return null;
  }

  const normalizedPath = rawPath.replace(/^\/+/, '').replace(/\//g, '.').trim();

  if (!normalizedPath) {
    return source;
  }

  if (normalizedPath.startsWith(`${source}.`) || normalizedPath === source) {
    return normalizedPath;
  }

  return `${source}.${normalizedPath}`;
}

function parseValidationPayload(
  errorRecord: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!errorRecord) {
    return {};
  }

  const message = asString(errorRecord.message);

  if (!message?.trim().startsWith('{')) {
    return errorRecord;
  }

  try {
    const parsed = JSON.parse(message);
    const parsedRecord = asRecord(parsed);

    if (!parsedRecord) {
      return errorRecord;
    }

    return {
      ...parsedRecord,
      ...errorRecord,
    };
  } catch {
    return errorRecord;
  }
}

function buildValidationDetails(error: unknown): ValidationDetails {
  const payload = parseValidationPayload(asRecord(error));
  const source = asString(payload.on) ?? 'request';

  const rawIssues = Array.isArray(payload.all)
    ? payload.all
    : Array.isArray(payload.errors)
      ? payload.errors
      : [];

  const issues: ValidationIssue[] = [];

  for (const issue of rawIssues) {
    const issueRecord = asRecord(issue);
    if (!issueRecord) {
      continue;
    }

    const field =
      normalizeValidationField(
        source,
        issueRecord.path ?? issueRecord.instancePath ?? issueRecord.property,
      ) ?? source;
    const reason =
      asString(issueRecord.message) ??
      asString(issueRecord.summary) ??
      'Invalid value.';

    const detail: ValidationIssue = {
      field,
      reason,
    };

    if (issueRecord.expected !== undefined) {
      detail.expected = issueRecord.expected;
    }

    const receivedValue =
      issueRecord.value !== undefined ? issueRecord.value : issueRecord.found;

    if (receivedValue !== undefined) {
      detail.received = receivedValue;
    }

    issues.push(detail);
  }

  const summary =
    asString(payload.summary) ??
    asString(payload.message) ??
    issues[0]?.reason ??
    'Request payload is invalid.';

  if (issues.length === 0) {
    const fallbackField =
      normalizeValidationField(source, payload.property) ?? source;

    issues.push({
      field: fallbackField,
      reason: summary,
      ...(payload.expected !== undefined ? { expected: payload.expected } : {}),
      ...(payload.found !== undefined ? { received: payload.found } : {}),
    });
  }

  return {
    source,
    summary,
    issues,
  };
}

function applyHeaders(
  headers: Record<string, string | number | undefined>,
  extraHeaders: Record<string, string>,
): void {
  for (const [name, value] of Object.entries(extraHeaders)) {
    headers[name] = value;
  }
}

function resolveCorsOrigin(origin: string | null): string | null {
  if (!origin) {
    return null;
  }

  if (env.CORS_ALLOWED_ORIGINS.includes('*')) {
    return '*';
  }

  return env.CORS_ALLOWED_ORIGINS.includes(origin) ? origin : null;
}

function buildCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin');
  const allowedOrigin = resolveCorsOrigin(origin);

  if (!allowedOrigin) {
    return {};
  }

  const allowHeaders =
    request.headers.get('access-control-request-headers') ??
    'authorization, content-type';

  const headers: Record<string, string> = {
    'access-control-allow-origin': allowedOrigin,
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': allowHeaders,
    'access-control-max-age': '86400',
  };

  if (allowedOrigin !== '*') {
    headers['access-control-allow-credentials'] = 'true';
    headers.vary = 'Origin';
  }

  return headers;
}

function toStatusCode(status: unknown): number {
  if (typeof status === 'number') {
    return status;
  }

  if (typeof status === 'string') {
    const parsed = Number(status);
    return Number.isFinite(parsed) ? parsed : 200;
  }

  return 200;
}

export const httpMiddlewares = new Elysia({
  name: 'http-middlewares',
})
  .onRequest(({ request, set }) => {
    requestStartedAt.set(request, Date.now());

    const requestId =
      request.headers.get('x-request-id') ?? crypto.randomUUID();
    requestIds.set(request, requestId);

    set.headers['x-request-id'] = requestId;
    applyHeaders(set.headers, securityHeaders);
    applyHeaders(set.headers, buildCorsHeaders(request));

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...buildCorsHeaders(request),
          ...securityHeaders,
          'x-request-id': requestId,
        },
      });
    }
  })
  .onError({ as: 'global' }, ({ code, error, request, set }) => {
    const requestId = requestIds.get(request);
    const pathname = new URL(request.url).pathname;

    if (requestId) {
      set.headers['x-request-id'] = requestId;
    }

    applyHeaders(set.headers, securityHeaders);
    applyHeaders(set.headers, buildCorsHeaders(request));

    if (error instanceof AppError) {
      set.status = error.statusCode;
      return {
        error: error.code,
        message: error.message,
        details: error.details,
      };
    }

    if (code === 'VALIDATION') {
      const details = buildValidationDetails(error);

      logger.warn(
        {
          requestId,
          method: request.method,
          path: pathname,
          validation: details,
        },
        'Validation error',
      );

      set.status = 422;
      return {
        error: 'VALIDATION_ERROR',
        message: 'Request payload is invalid.',
        details,
      };
    }

    if (code === 'NOT_FOUND') {
      set.status = 404;
      return {
        error: 'NOT_FOUND',
        message: 'Route not found.',
      };
    }

    logger.error(
      {
        requestId,
        method: request.method,
        path: pathname,
        err: error,
      },
      'Unexpected API error',
    );
    Sentry.captureException(error);

    set.status = 500;
    return {
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error happened.',
    };
  })
  .onAfterResponse(({ request, set }) => {
    if (!env.LOG_HTTP_REQUESTS) {
      return;
    }

    const startedAt = requestStartedAt.get(request);
    const durationMs = startedAt ? Date.now() - startedAt : 0;
    const statusCode = toStatusCode(set.status);
    const requestId = requestIds.get(request);
    const pathname = new URL(request.url).pathname;

    logger.info(
      {
        requestId,
        method: request.method,
        path: pathname,
        statusCode,
        durationMs,
      },
      'HTTP request completed',
    );
  });
