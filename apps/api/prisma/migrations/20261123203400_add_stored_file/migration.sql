-- CreateEnum
CREATE TYPE "StoredFileVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "StoredFilePurpose" AS ENUM ('AVATAR', 'PUBLIC_IMAGE', 'DOCUMENT', 'VALIDATION');

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "visibility" "StoredFileVisibility" NOT NULL,
    "purpose" "StoredFilePurpose" NOT NULL,
    "bucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoredFile_bucket_objectKey_key" ON "StoredFile"("bucket", "objectKey");

-- CreateIndex
CREATE INDEX "StoredFile_tenantId_idx" ON "StoredFile"("tenantId");

-- CreateIndex
CREATE INDEX "StoredFile_uploadedByUserId_idx" ON "StoredFile"("uploadedByUserId");

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
