import { describe, expect, it } from 'vitest';
import { assertEmailDeliveryReady, resolveEmailDelivery } from './email-config';

const configured = {
  nodeEnv: 'production',
  resendApiKey: 're_test_key',
  emailFrom: 'MyroPhone <no-reply@example.com>',
  appWebUrl: 'https://app.myrophone.test',
};

describe('resolveEmailDelivery', () => {
  it('keeps activation optional in development when Resend is not configured', () => {
    expect(
      resolveEmailDelivery({
        nodeEnv: 'development',
        resendApiKey: undefined,
        emailFrom: undefined,
        appWebUrl: undefined,
      }),
    ).toEqual({ enabled: false });
  });

  it('keeps activation optional in test when Resend is not configured', () => {
    expect(
      resolveEmailDelivery({
        nodeEnv: 'test',
        resendApiKey: undefined,
        emailFrom: undefined,
        appWebUrl: undefined,
      }),
    ).toEqual({ enabled: false });

    expect(() =>
      assertEmailDeliveryReady({
        nodeEnv: 'development',
        resendApiKey: undefined,
        emailFrom: undefined,
        appWebUrl: undefined,
      }),
    ).not.toThrow();
  });

  it('requires activation when the API key, from address, and web URL are set', () => {
    expect(resolveEmailDelivery(configured)).toEqual({
      enabled: true,
      apiKey: configured.resendApiKey,
      from: configured.emailFrom,
      webUrl: configured.appWebUrl,
    });
  });

  it('refuses to boot in production when Resend is not configured', () => {
    expect(() =>
      assertEmailDeliveryReady({
        nodeEnv: 'production',
        resendApiKey: undefined,
        emailFrom: 'MyroPhone <no-reply@example.com>',
        appWebUrl: 'https://app.myrophone.test',
      }),
    ).toThrow(/RESEND_API_KEY/);
  });

  it('refuses to boot in production when the from address or web URL is missing', () => {
    expect(() =>
      assertEmailDeliveryReady({
        ...configured,
        emailFrom: '   ',
      }),
    ).toThrow(/EMAIL_FROM/);

    expect(() =>
      assertEmailDeliveryReady({
        ...configured,
        appWebUrl: undefined,
      }),
    ).toThrow(/APP_WEB_URL/);
  });
});
