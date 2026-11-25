import { env } from '../../core/config/env';

export interface EmailEnv {
  nodeEnv: string;
  resendApiKey: string | undefined;
  emailFrom: string | undefined;
  appWebUrl: string | undefined;
}

export type EmailDelivery =
  | { enabled: false }
  | {
      enabled: true;
      apiKey: string;
      from: string;
      webUrl: string;
    };

function blankToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function readEmailEnv(): EmailEnv {
  return {
    nodeEnv: process.env.NODE_ENV ?? env.NODE_ENV,
    resendApiKey: env.RESEND_API_KEY,
    emailFrom: env.EMAIL_FROM,
    appWebUrl: env.APP_WEB_URL,
  };
}

function present(source: EmailEnv): {
  apiKey: string;
  from: string;
  webUrl: string;
} | null {
  const apiKey = blankToUndefined(source.resendApiKey);
  const from = blankToUndefined(source.emailFrom);
  const webUrl = blankToUndefined(source.appWebUrl);

  if (!apiKey || !from || !webUrl) {
    return null;
  }

  return { apiKey, from, webUrl };
}

export function resolveEmailDelivery(
  source: EmailEnv = readEmailEnv(),
): EmailDelivery {
  const ready = present(source);

  if (!ready) {
    return { enabled: false };
  }

  return {
    enabled: true,
    apiKey: ready.apiKey,
    from: ready.from,
    webUrl: ready.webUrl.replace(/\/$/, ''),
  };
}

export function assertEmailDeliveryReady(
  source: EmailEnv = readEmailEnv(),
): EmailDelivery {
  const delivery = resolveEmailDelivery(source);

  if (source.nodeEnv !== 'production' || delivery.enabled) {
    return delivery;
  }

  const missing = [
    blankToUndefined(source.resendApiKey) ? null : 'RESEND_API_KEY',
    blankToUndefined(source.emailFrom) ? null : 'EMAIL_FROM',
    blankToUndefined(source.appWebUrl) ? null : 'APP_WEB_URL',
  ].filter((name): name is string => name !== null);

  throw new Error(
    `Email delivery is required in production. Set ${missing.join(', ')}.`,
  );
}

export function isEmailActivationRequired(
  source: EmailEnv = readEmailEnv(),
): boolean {
  return resolveEmailDelivery(source).enabled;
}
