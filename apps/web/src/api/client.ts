import { treaty, type Treaty } from '@elysiajs/eden';
import type { App } from '@myrophone/api/app';
import { sessionFetch } from '../features/auth/session-renewal';
import { readAccessToken } from '../features/auth/token-store';
import { apiBaseUrl } from './base-url';

export type ApiClient = Treaty.Create<App>;

let apiClient: ApiClient | undefined;

export function getApi(): ApiClient {
  apiClient ??= treaty<App>(apiBaseUrl(), {
    fetcher: sessionFetch,
    headers: () => {
      const accessToken = readAccessToken();

      if (!accessToken) {
        return {};
      }

      return {
        authorization: `Bearer ${accessToken}`,
      };
    },
  });

  return apiClient;
}
