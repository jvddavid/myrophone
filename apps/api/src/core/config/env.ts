function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parsePositiveNumber(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = parseNumber(value, fallback);
  return parsed > 0 ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function optionalEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseCsv(value: string | undefined, fallback: string[]): string[] {
  if (!value) {
    return fallback;
  }

  const parsed = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : fallback;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';

export const env = {
  NODE_ENV: nodeEnv,
  PORT: parseNumber(process.env.PORT, 3000),
  DATABASE_URL:
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/myrophone?schema=public',
  REDIS_HOST: process.env.REDIS_HOST ?? '127.0.0.1',
  REDIS_PORT: parsePositiveNumber(process.env.REDIS_PORT, 6379),
  JWT_SECRET: process.env.JWT_SECRET ?? 'myrophone-dev-secret-change-me',
  JWT_ACCESS_TTL: process.env.JWT_ACCESS_TTL ?? '15m',
  REFRESH_TOKEN_TTL_DAYS: parseNumber(process.env.REFRESH_TOKEN_TTL_DAYS, 7),
  CORS_ALLOWED_ORIGINS: parseCsv(process.env.CORS_ALLOWED_ORIGINS, ['*']),
  LOG_HTTP_REQUESTS: parseBoolean(
    process.env.LOG_HTTP_REQUESTS,
    nodeEnv !== 'test',
  ),
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
  SENTRY_DSN: process.env.SENTRY_DSN,
  S3_ENDPOINT: process.env.S3_ENDPOINT ?? 'http://127.0.0.1:9000',
  S3_REGION: process.env.S3_REGION ?? 'us-east-1',
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY ?? 'minioadmin',
  S3_SECRET_KEY: process.env.S3_SECRET_KEY ?? 'minioadmin',
  S3_PUBLIC_BUCKET: process.env.S3_PUBLIC_BUCKET ?? 'myrophone-public',
  S3_PRIVATE_BUCKET: process.env.S3_PRIVATE_BUCKET ?? 'myrophone-private',
  S3_PUBLIC_BASE_URL:
    process.env.S3_PUBLIC_BASE_URL ?? 'http://127.0.0.1:9000/myrophone-public',
  get RESEND_API_KEY(): string | undefined {
    return optionalEnv(process.env.RESEND_API_KEY);
  },
  get EMAIL_FROM(): string | undefined {
    return optionalEnv(process.env.EMAIL_FROM);
  },
  get APP_WEB_URL(): string | undefined {
    return optionalEnv(process.env.APP_WEB_URL);
  },
};
