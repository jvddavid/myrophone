import type { PrismaDb } from '../../modules/auth/db-types';
import { env } from '../config/env';

type PrismaClientConstructor = new (options?: {
  log?: Array<'warn' | 'error'>;
  adapter?: unknown;
  accelerateUrl?: string;
}) => PrismaDb;

type PrismaPgConstructor = new (options: {
  connectionString: string;
}) => unknown;

type PrismaModuleShape = {
  PrismaClient?: PrismaClientConstructor;
};

type PrismaAdapterPgModuleShape = {
  PrismaPg?: PrismaPgConstructor;
};

function isPrismaModuleShape(value: unknown): value is PrismaModuleShape {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as { PrismaClient?: unknown };

  if (candidate.PrismaClient === undefined) {
    return true;
  }

  return typeof candidate.PrismaClient === 'function';
}

function isPrismaAdapterPgModuleShape(
  value: unknown,
): value is PrismaAdapterPgModuleShape {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as { PrismaPg?: unknown };

  if (candidate.PrismaPg === undefined) {
    return true;
  }

  return typeof candidate.PrismaPg === 'function';
}

type GlobalWithPrisma = typeof globalThis & {
  __myrophonePrisma?: PrismaDb;
};

const globalForPrisma = globalThis as GlobalWithPrisma;

let prismaInitializationError: Error | null = null;

export async function getPrisma(): Promise<PrismaDb> {
  if (globalForPrisma.__myrophonePrisma) {
    return globalForPrisma.__myrophonePrisma;
  }

  if (prismaInitializationError) {
    throw prismaInitializationError;
  }

  try {
    const prismaClientModuleName = '@prisma/client';
    const prismaAdapterPgModuleName = ['@prisma', 'adapter-pg'].join('/');

    const [prismaModuleUnknown, prismaAdapterPgModuleUnknown]: [
      unknown,
      unknown,
    ] = await Promise.all([
      import(prismaClientModuleName),
      import(prismaAdapterPgModuleName),
    ]);

    if (!isPrismaModuleShape(prismaModuleUnknown)) {
      throw new Error('Invalid Prisma module shape.');
    }

    if (!isPrismaAdapterPgModuleShape(prismaAdapterPgModuleUnknown)) {
      throw new Error('Invalid Prisma adapter module shape.');
    }

    const PrismaClient = prismaModuleUnknown.PrismaClient;
    const PrismaPg = prismaAdapterPgModuleUnknown.PrismaPg;

    if (!PrismaClient) {
      throw new Error(
        "Prisma Client is not generated. Run 'bun run --cwd apps/api prisma:generate'.",
      );
    }

    if (!PrismaPg) {
      throw new Error(
        "Prisma PostgreSQL adapter is not available. Install '@prisma/adapter-pg'.",
      );
    }

    const adapter = new PrismaPg({
      connectionString: env.DATABASE_URL,
    });

    const client = new PrismaClient({
      log:
        process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
      adapter,
    });

    globalForPrisma.__myrophonePrisma = client;
    return client;
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message
        : 'Unknown Prisma initialization error';

    prismaInitializationError = new Error(
      `Failed to initialize Prisma Client. ${reason}`,
    );

    throw prismaInitializationError;
  }
}
