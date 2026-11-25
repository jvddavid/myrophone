import { describe, expect, it, vi } from 'vitest';
import {
  deliverActivationEmail,
  type EmailTransport,
  transportFor,
  useEmailTransport,
} from './mailer';

const from = 'MyroPhone <no-reply@example.com>';
const token = 'act-token.act-token';
const code = '048215';

function transport(): EmailTransport & {
  send: ReturnType<typeof vi.fn>;
} {
  return {
    send: vi.fn(async () => undefined),
  };
}

describe('deliverActivationEmail', () => {
  it('does not call the transport when Resend is not configured', async () => {
    const client = transport();

    const result = await deliverActivationEmail({
      delivery: { enabled: false },
      transport: client,
      to: 'ana@example.com',
      name: 'Ana',
      token,
      code,
    });

    expect(result).toBe('skipped');
    expect(client.send).not.toHaveBeenCalled();
  });

  it('sends the rendered activation email with the link and the code', async () => {
    const client = transport();

    const result = await deliverActivationEmail({
      delivery: {
        enabled: true,
        apiKey: 're_test_key',
        from,
        webUrl: 'https://app.myrophone.test',
      },
      transport: client,
      to: 'ana@example.com',
      name: 'Ana',
      token,
      code,
    });

    expect(result).toBe('sent');
    expect(client.send).toHaveBeenCalledTimes(1);

    const message = client.send.mock.calls[0]?.[0] as {
      from: string;
      to: string;
      subject: string;
      html: string;
      text: string;
    };

    expect(message.from).toBe(from);
    expect(message.to).toBe('ana@example.com');
    expect(message.subject).toBe('Ative seu e-mail no MyroPhone');
    expect(message.html).toContain(
      `https://app.myrophone.test/ativar?token=${token}`,
    );
    expect(message.html).toContain(code);
    expect(message.html).toContain('Ana');
    expect(message.text).toContain(code);
    expect(message.text).toContain(token);
  });

  it('does not construct a live Resend client while tests are running', () => {
    useEmailTransport(undefined);

    expect(() => transportFor('re_test_key')).toThrow(/useEmailTransport/);
  });
});
