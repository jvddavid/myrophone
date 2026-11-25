import { getPrisma } from '../../core/db/prisma';
import { asType, type PrismaDb, type SimpleDbDelegate } from '../auth/db-types';

export interface NewEmailActivation {
  userId: string;
  tokenHash: string;
  codeHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface EmailActivationRecord extends NewEmailActivation {
  id: string;
  usedAt: Date | null;
}

export interface EmailActivationStore {
  insert(input: NewEmailActivation): Promise<EmailActivationRecord>;
  findByTokenHash(tokenHash: string): Promise<EmailActivationRecord | null>;
  findLatestByUserId(userId: string): Promise<EmailActivationRecord | null>;
  claim(id: string, usedAt: Date): Promise<boolean>;
  markEmailVerified(userId: string, verifiedAt: Date): Promise<void>;
  deleteById(id: string): Promise<void>;
  retireUnusedExcept(
    userId: string,
    keepId: string,
    usedAt: Date,
  ): Promise<void>;
}

interface EmailVerificationDb extends PrismaDb {
  emailVerification: SimpleDbDelegate;
}

export function prismaEmailActivationStore(
  prisma: EmailVerificationDb,
): EmailActivationStore {
  return {
    async insert(input) {
      return asType<EmailActivationRecord>(
        await prisma.emailVerification.create({ data: input }),
      );
    },
    async findByTokenHash(tokenHash) {
      return asType<EmailActivationRecord | null>(
        await prisma.emailVerification.findUnique({ where: { tokenHash } }),
      );
    },
    async findLatestByUserId(userId) {
      return asType<EmailActivationRecord | null>(
        await prisma.emailVerification.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        }),
      );
    },
    async claim(id, usedAt) {
      const result = asType<{ count: number }>(
        await prisma.emailVerification.updateMany({
          where: { id, usedAt: null },
          data: { usedAt },
        }),
      );
      return result.count === 1;
    },
    async markEmailVerified(userId, verifiedAt) {
      await prisma.user.update({
        where: { id: userId },
        data: { emailVerifiedAt: verifiedAt },
      });
    },
    async deleteById(id) {
      await prisma.emailVerification.delete({ where: { id } });
    },
    async retireUnusedExcept(userId, keepId, usedAt) {
      await prisma.emailVerification.updateMany({
        where: {
          userId,
          usedAt: null,
          id: { not: keepId },
        },
        data: { usedAt },
      });
    },
  };
}

export async function createPrismaEmailActivationStore(): Promise<EmailActivationStore> {
  const prisma = asType<EmailVerificationDb>(await getPrisma());
  return prismaEmailActivationStore(prisma);
}
