import { readAccessToken } from '../auth/token-store';

const messages: Record<string, string> = {
  STORAGE_UNAVAILABLE:
    'Não foi possível guardar a imagem. O armazenamento de arquivos está indisponível.',
  FILE_TOO_LARGE: 'A imagem passa de 5 MB.',
  INVALID_CONTENT_TYPE: 'Use uma imagem JPEG, PNG, WEBP ou GIF.',
  NOT_COMPANY_OWNER: 'Só o dono pode alterar o logo desta empresa.',
  FILE_REQUIRED: 'Escolha uma imagem.',
  EMPTY_FILE: 'O arquivo está vazio.',
};

export class FileRequestError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'FileRequestError';
    this.code = code;
  }
}

function apiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL?.trim();

  if (configured) {
    return configured.replace(/\/$/, '');
  }

  return `${window.location.origin}/api`;
}

function fileErrorMessage(code: string, fallback: string): string {
  return messages[code] ?? fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export async function uploadStoredFile(input: {
  purpose: 'AVATAR' | 'LOGO';
  file: File;
  tenantId?: string;
}): Promise<{ id: string; url: string }> {
  const form = new FormData();
  form.set('purpose', input.purpose);
  form.set('file', input.file);

  if (input.tenantId) {
    form.set('tenantId', input.tenantId);
  }

  const token = readAccessToken();
  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl()}/files`, {
      method: 'POST',
      headers: token ? { authorization: `Bearer ${token}` } : {},
      body: form,
    });
  } catch {
    throw new FileRequestError(
      'UNKNOWN',
      'Não foi possível falar com a API.',
    );
  }

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const record = isRecord(body) ? body : {};
    const code = typeof record.error === 'string' ? record.error : 'UNKNOWN';
    const fallback =
      typeof record.message === 'string'
        ? record.message
        : 'Não foi possível enviar a imagem.';

    throw new FileRequestError(code, fileErrorMessage(code, fallback));
  }

  const body: unknown = await response.json().catch(() => null);
  const record = isRecord(body) ? body : {};

  if (typeof record.id !== 'string' || typeof record.url !== 'string') {
    throw new FileRequestError(
      'INVALID_RESPONSE',
      'A API devolveu um arquivo incompleto.',
    );
  }

  return { id: record.id, url: record.url };
}
