export function registerPasswordError(
  password: string,
  confirmPassword: string,
): string | null {
  if (password !== confirmPassword) {
    return 'As senhas não coincidem.';
  }

  return null;
}
