import {
  type AppJobKey,
  getJobDefinition,
  jobCatalog,
} from '@myrophone/shared';

function parseOptionalPositiveNumber(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function parseJobOverrideMap(
  input: string | undefined,
): Partial<Record<AppJobKey, number>> {
  if (!input) {
    return {};
  }

  const overrides: Partial<Record<AppJobKey, number>> = {};

  for (const entry of input.split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) {
      continue;
    }

    const [rawJobKey, rawValue] = trimmed.split('=', 2);
    const jobKeyCandidate = rawJobKey?.trim();
    const valueCandidate = rawValue?.trim();

    if (!jobKeyCandidate || !valueCandidate) {
      continue;
    }

    if (!Object.hasOwn(jobCatalog, jobKeyCandidate)) {
      continue;
    }

    const value = parseOptionalPositiveNumber(valueCandidate);
    if (!value) {
      continue;
    }

    const jobKey = jobKeyCandidate as AppJobKey;
    overrides[jobKey] = value;
  }

  return overrides;
}

const globalDefaultTimeoutMs = parseOptionalPositiveNumber(
  process.env.JOBS_DEFAULT_TIMEOUT_MS,
);
const globalDefaultConcurrency = parseOptionalPositiveNumber(
  process.env.JOBS_DEFAULT_CONCURRENCY,
);

const timeoutOverrides = parseJobOverrideMap(
  process.env.JOBS_TIMEOUT_OVERRIDES,
);
const concurrencyOverrides = parseJobOverrideMap(
  process.env.JOBS_CONCURRENCY_OVERRIDES,
);

export function getJobTimeoutMs(jobKey: AppJobKey): number {
  const override = timeoutOverrides[jobKey];
  if (override) {
    return override;
  }

  if (globalDefaultTimeoutMs) {
    return globalDefaultTimeoutMs;
  }

  return getJobDefinition(jobKey).defaults.timeoutMs;
}

export function getJobConcurrency(jobKey: AppJobKey): number {
  const override = concurrencyOverrides[jobKey];
  if (override) {
    return override;
  }

  if (globalDefaultConcurrency) {
    return globalDefaultConcurrency;
  }

  return getJobDefinition(jobKey).defaults.concurrency;
}
