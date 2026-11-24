import { describe, expect, it } from 'vitest';
import {
  createS3ClientConfig,
  PRESIGNED_GET_TTL_SECONDS,
  publicObjectReadPolicy,
} from './storage';

describe('s3 storage settings', () => {
  it('forces path-style access for MinIO', () => {
    const config = createS3ClientConfig({
      endpoint: 'http://127.0.0.1:9000',
      region: 'us-east-1',
      accessKey: 'minioadmin',
      secretKey: 'minioadmin',
      publicBucket: 'myrophone-public',
      privateBucket: 'myrophone-private',
      publicBaseUrl: 'http://127.0.0.1:9000/myrophone-public',
    });

    expect(config.forcePathStyle).toBe(true);
    expect(config.endpoint).toBe('http://127.0.0.1:9000');
    expect(config.region).toBe('us-east-1');
    expect(config.requestChecksumCalculation).toBe('WHEN_REQUIRED');
    expect(PRESIGNED_GET_TTL_SECONDS).toBe(300);
  });

  it('allows anonymous object reads on the public bucket and does not allow listing', () => {
    const policy = JSON.parse(publicObjectReadPolicy('myrophone-public')) as {
      Statement: Array<{
        Effect: string;
        Action: string[];
        Resource: string[];
      }>;
    };

    expect(policy.Statement).toHaveLength(1);
    expect(policy.Statement[0]?.Effect).toBe('Allow');
    expect(policy.Statement[0]?.Action).toEqual(['s3:GetObject']);
    expect(policy.Statement[0]?.Resource).toEqual([
      'arn:aws:s3:::myrophone-public/*',
    ]);
    expect(JSON.stringify(policy)).not.toContain('ListBucket');
    expect(JSON.stringify(policy)).not.toContain('myrophone-private');
  });
});
