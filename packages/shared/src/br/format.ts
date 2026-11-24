const legacyDefaultPhone = '00000000';
const phoneAllowed = /^[\d\s()+-]+$/;

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const decimalFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const maxPercentHundredths = 10000;
const maxCentsDigits = 15;

function plainSpaces(value: string): string {
  return value.replace(/[\u00a0\u202f]/g, ' ');
}

export function brazilPhoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function maskBrazilPhoneDigits(digits: string): string {
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);

  if (digits.length < 2) {
    return `(${digits}`;
  }

  if (digits.length === 2) {
    return `(${ddd})`;
  }

  if (digits.length === 11) {
    return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  }

  if (rest.length <= 4) {
    return `(${ddd}) ${rest}`;
  }

  return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
}

export function formatBrazilPhone(value: string): string {
  const digits = brazilPhoneDigits(value);

  if (digits.length === 0) {
    return '';
  }

  if (digits === legacyDefaultPhone) {
    return legacyDefaultPhone;
  }

  if (digits.length > 11) {
    return digits;
  }

  return maskBrazilPhoneDigits(digits);
}

export function parseBrazilPhone(value: string): string | null {
  const trimmed = value.trim();

  if (!phoneAllowed.test(trimmed)) {
    return null;
  }

  const digits = trimmed.replace(/[\s()+-]/g, '');

  if (digits.length === 10 || digits.length === 11) {
    return digits;
  }

  return null;
}

export function formatBrlFromCents(cents: number): string {
  const amount = Number.isFinite(cents) ? Math.trunc(cents) : 0;
  return plainSpaces(brlFormatter.format(amount / 100));
}

export function parseBrlToCents(value: string): number {
  const digits = value.replace(/\D/g, '').slice(0, maxCentsDigits);

  if (digits.length === 0) {
    return 0;
  }

  return Number(digits);
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), 100);
}

export function formatBrazilPercent(value: number): string {
  return `${plainSpaces(decimalFormatter.format(clampPercent(value)))}%`;
}

export function parseBrazilPercent(value: string): number {
  const digits = value.replace(/\D/g, '');

  if (digits.length === 0) {
    return 0;
  }

  const hundredths = Number(digits);

  if (!Number.isFinite(hundredths)) {
    return 100;
  }

  return Math.min(hundredths, maxPercentHundredths) / 100;
}

export function nextMaskDigits(
  previousFormatted: string,
  nextRaw: string,
): string {
  const previousDigits = previousFormatted.replace(/\D/g, '');
  const nextDigits = nextRaw.replace(/\D/g, '');

  if (
    nextDigits === previousDigits &&
    nextRaw.length < previousFormatted.length
  ) {
    return previousDigits.slice(0, -1);
  }

  return nextDigits;
}
