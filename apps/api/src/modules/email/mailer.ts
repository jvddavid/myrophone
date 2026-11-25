import { render } from 'react-email';
import { Resend } from 'resend';
import { ActivationEmail } from './activation-email';
import { activationUrl, EMAIL_ACTIVATION_TTL_MS } from './activation-link';
import type { EmailDelivery } from './email-config';

export const ACTIVATION_EMAIL_SUBJECT = 'Ative seu e-mail no MyroPhone';

export interface OutboundEmail {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailTransport {
  send(message: OutboundEmail): Promise<void>;
}

let transportOverride: EmailTransport | undefined;

export function useEmailTransport(transport: EmailTransport | undefined): void {
  transportOverride = transport;
}

export function createResendTransport(apiKey: string): EmailTransport {
  const resend = new Resend(apiKey);

  return {
    async send(message) {
      const { error } = await resend.emails.send({
        from: message.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      });

      if (error) {
        throw new Error(error.message);
      }
    },
  };
}

export function transportFor(apiKey: string): EmailTransport {
  if (transportOverride) {
    return transportOverride;
  }

  if ((process.env.NODE_ENV ?? 'development') === 'test') {
    throw new Error(
      'Refusing to call Resend from tests without useEmailTransport().',
    );
  }

  return createResendTransport(apiKey);
}

export async function deliverActivationEmail(input: {
  delivery: EmailDelivery;
  transport: EmailTransport;
  to: string;
  name: string;
  token: string;
  code: string;
}): Promise<'sent' | 'skipped'> {
  if (!input.delivery.enabled) {
    return 'skipped';
  }

  const actionUrl = activationUrl(input.delivery.webUrl, input.token);
  const expiresInMinutes = EMAIL_ACTIVATION_TTL_MS / 60_000;
  const element = ActivationEmail({
    name: input.name,
    actionUrl,
    code: input.code,
    expiresInMinutes,
  });
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);

  await input.transport.send({
    from: input.delivery.from,
    to: input.to,
    subject: ACTIVATION_EMAIL_SUBJECT,
    html,
    text,
  });

  return 'sent';
}
