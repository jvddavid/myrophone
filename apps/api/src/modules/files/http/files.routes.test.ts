import { describe, expect, it } from 'vitest';
import { app } from '../../../app';

describe('file routes', () => {
  it('requires a session to upload, read, or delete', async () => {
    const upload = await app.handle(
      new Request('http://localhost/files', { method: 'POST' }),
    );
    const read = await app.handle(new Request('http://localhost/files/file-1'));
    const remove = await app.handle(
      new Request('http://localhost/files/file-1', { method: 'DELETE' }),
    );

    expect(upload.status).toBe(401);
    expect(read.status).toBe(401);
    expect(remove.status).toBe(401);
    expect(((await upload.json()) as { error?: string }).error).toBe(
      'UNAUTHORIZED',
    );
  });
});
