import { decodeJwt } from 'jose';
import { describe, expect, it } from 'vitest';
import { signAccessToken, verifyAccessToken } from './token';

describe('access token company claim', () => {
  it('omits tenantId when the session has no company', async () => {
    const token = await signAccessToken({
      userId: 'user-1',
      sessionId: 'session-1',
      tenantId: null,
      email: 'ana@auth-test.local',
    });
    const claims = decodeJwt(token);
    const verified = await verifyAccessToken(token);

    expect(claims.tenantId).toBeUndefined();
    expect(verified).toMatchObject({
      sub: 'user-1',
      sid: 'session-1',
      tenantId: null,
      email: 'ana@auth-test.local',
    });
  });

  it('keeps tenantId when the session has a company', async () => {
    const token = await signAccessToken({
      userId: 'user-1',
      sessionId: 'session-1',
      tenantId: 'tenant-1',
      email: 'ana@auth-test.local',
    });
    const verified = await verifyAccessToken(token);

    expect(verified?.tenantId).toBe('tenant-1');
  });
});
