import { describe, expect, it } from 'vitest';
import { ensureStorageReady } from './bootstrap';

describe('storage bootstrap', () => {
  it('does not contact storage while tests are running', async () => {
    let calls = 0;

    await ensureStorageReady();
    await ensureStorageReady({
      nodeEnv: 'test',
      ensureBuckets: async () => {
        calls += 1;
      },
    });

    expect(calls).toBe(0);
  });

  it('keeps booting in development when MinIO is down', async () => {
    await expect(
      ensureStorageReady({
        nodeEnv: 'development',
        ensureBuckets: async () => {
          throw new Error('connect ECONNREFUSED');
        },
      }),
    ).resolves.toBeUndefined();
  });

  it('fails startup outside development when buckets cannot be prepared', async () => {
    await expect(
      ensureStorageReady({
        nodeEnv: 'production',
        ensureBuckets: async () => {
          throw new Error('bucket bootstrap failed');
        },
      }),
    ).rejects.toThrow('bucket bootstrap failed');
  });
});
