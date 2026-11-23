import { treaty, type Treaty } from '@elysiajs/eden';
import type { App } from '@myrophone/api/app';

export type ApiClient = Treaty.Create<App>;

function apiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL?.trim();

  if (configured) {
    return configured.replace(/\/$/, '');
  }

  return `${window.location.origin}/api`;
}

let apiClient: ApiClient | undefined;

export function getApi(): ApiClient {
  apiClient ??= treaty<App>(apiBaseUrl());
  return apiClient;
}
