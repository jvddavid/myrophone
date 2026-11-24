import {
  type BucketLocationConstraint,
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../core/config/env';
import { buildPublicObjectUrl } from './rules';
import type { FileStorage } from './types';

export const PRESIGNED_GET_TTL_SECONDS = 300;

export interface S3StorageSettings {
  endpoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
  publicBucket: string;
  privateBucket: string;
  publicBaseUrl: string;
}

export function publicObjectReadPolicy(bucket: string): string {
  return JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'PublicReadObjects',
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${bucket}/*`],
      },
    ],
  });
}

export function createS3ClientConfig(
  settings: S3StorageSettings,
): S3ClientConfig {
  return {
    region: settings.region,
    endpoint: settings.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: settings.accessKey,
      secretAccessKey: settings.secretKey,
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    maxAttempts: 2,
  };
}

function storageSettings(): S3StorageSettings {
  return {
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    accessKey: env.S3_ACCESS_KEY,
    secretKey: env.S3_SECRET_KEY,
    publicBucket: env.S3_PUBLIC_BUCKET,
    privateBucket: env.S3_PRIVATE_BUCKET,
    publicBaseUrl: env.S3_PUBLIC_BASE_URL,
  };
}

function errorName(error: unknown): string {
  if (!error || typeof error !== 'object' || !('name' in error)) {
    return '';
  }

  return typeof error.name === 'string' ? error.name : '';
}

function errorStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('$metadata' in error)) {
    return null;
  }

  const metadata = error.$metadata;

  if (
    !metadata ||
    typeof metadata !== 'object' ||
    !('httpStatusCode' in metadata)
  ) {
    return null;
  }

  return typeof metadata.httpStatusCode === 'number'
    ? metadata.httpStatusCode
    : null;
}

function isMissingBucket(error: unknown): boolean {
  const name = errorName(error);
  return (
    errorStatus(error) === 404 || name === 'NotFound' || name === 'NoSuchBucket'
  );
}

function isBucketAlreadyExists(error: unknown): boolean {
  const name = errorName(error);
  return name === 'BucketAlreadyOwnedByYou' || name === 'BucketAlreadyExists';
}

async function ensureBucket(
  client: S3Client,
  bucket: string,
  region: string,
): Promise<void> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return;
  } catch (error) {
    if (!isMissingBucket(error)) {
      throw error;
    }
  }

  try {
    await client.send(
      new CreateBucketCommand({
        Bucket: bucket,
        ...(region === 'us-east-1'
          ? {}
          : {
              CreateBucketConfiguration: {
                LocationConstraint: region as BucketLocationConstraint,
              },
            }),
      }),
    );
  } catch (error) {
    if (!isBucketAlreadyExists(error)) {
      throw error;
    }
  }
}

export async function ensureObjectBuckets(
  client: S3Client,
  input: {
    publicBucket: string;
    privateBucket: string;
    region: string;
  },
): Promise<void> {
  await ensureBucket(client, input.publicBucket, input.region);
  await client.send(
    new PutBucketPolicyCommand({
      Bucket: input.publicBucket,
      Policy: publicObjectReadPolicy(input.publicBucket),
    }),
  );
  await ensureBucket(client, input.privateBucket, input.region);
}

export function createS3FileStorage(
  settings: S3StorageSettings = storageSettings(),
): FileStorage {
  const client = new S3Client(createS3ClientConfig(settings));

  return {
    async putObject(input) {
      await client.send(
        new PutObjectCommand({
          Bucket: input.bucket,
          Key: input.objectKey,
          Body: input.bytes,
          ContentType: input.contentType,
          ContentLength: input.bytes.byteLength,
        }),
      );
    },
    async deleteObject(input) {
      await client.send(
        new DeleteObjectCommand({
          Bucket: input.bucket,
          Key: input.objectKey,
        }),
      );
    },
    publicUrl(objectKey) {
      return buildPublicObjectUrl(settings.publicBaseUrl, objectKey);
    },
    async privateUrl(input) {
      return getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: input.bucket,
          Key: input.objectKey,
        }),
        { expiresIn: PRESIGNED_GET_TTL_SECONDS },
      );
    },
    async ensureBuckets() {
      await ensureObjectBuckets(client, {
        publicBucket: settings.publicBucket,
        privateBucket: settings.privateBucket,
        region: settings.region,
      });
    },
  };
}

let storage: FileStorage | undefined;

export function getFileStorage(): FileStorage {
  storage ??= createS3FileStorage();
  return storage;
}
