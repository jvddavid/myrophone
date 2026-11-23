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

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  REDIS_HOST: process.env.REDIS_HOST ?? '127.0.0.1',
  REDIS_PORT: parsePositiveNumber(process.env.REDIS_PORT, 6379),
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
};
