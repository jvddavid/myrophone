export const EMAIL_ACTIVATION_TTL_MS = 30 * 60 * 1000;
export const EMAIL_RESEND_COOLDOWN_MS = 60 * 1000;

export function activationUrl(webUrl: string, token: string): string {
  const url = new URL('/ativar', `${webUrl}/`);
  url.searchParams.set('token', token);
  return url.toString();
}
