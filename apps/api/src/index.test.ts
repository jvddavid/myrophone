import { describe, expect, it } from 'vitest';
import { app } from './index';

describe('api health endpoint', () => {
  it('returns service status', async () => {
    const response = await app.handle(new Request('http://localhost/health'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ service: 'api', status: 'ok' });
  });

  it('applies security and request id headers', async () => {
    const response = await app.handle(new Request('http://localhost/health'));

    expect(response.headers.get('x-request-id')).toBeTruthy();
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
  });

  it('handles CORS preflight requests', async () => {
    const response = await app.handle(
      new Request('http://localhost/auth/login', {
        method: 'OPTIONS',
        headers: {
          origin: 'http://localhost:5173',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'authorization,content-type',
        },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('access-control-allow-methods')).toContain(
      'POST',
    );
    expect(response.headers.get('x-request-id')).toBeTruthy();
  });

  it('returns detailed validation errors with field and reason', async () => {
    const response = await app.handle(
      new Request('http://localhost/auth/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          email: 'invalid-email',
          password: '123',
        }),
      }),
    );

    const body = (await response.json()) as {
      error?: string;
      details?: {
        source?: string;
        summary?: string;
        issues?: Array<{ field?: string; reason?: string }>;
      };
    };

    expect(response.status).toBe(422);
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(body.details).toMatchObject({
      source: expect.any(String),
      summary: expect.any(String),
    });
    expect(Array.isArray(body.details?.issues)).toBe(true);
    expect(body.details?.issues?.length).toBeGreaterThan(0);
    expect(body.details?.issues?.[0]).toMatchObject({
      field: expect.any(String),
      reason: expect.any(String),
    });
  });
});
