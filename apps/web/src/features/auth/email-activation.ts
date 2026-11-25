export function needsEmailActivation(auth: {
  emailActivationRequired: boolean;
  user: { emailVerifiedAt: string | Date | null };
}): boolean {
  return auth.emailActivationRequired && auth.user.emailVerifiedAt == null;
}
