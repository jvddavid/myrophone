export type StoredFileVisibility = 'PUBLIC' | 'PRIVATE';

export type StoredFilePurpose =
  | 'AVATAR'
  | 'LOGO'
  | 'PUBLIC_IMAGE'
  | 'DOCUMENT'
  | 'VALIDATION';

export interface StoredFileRecord {
  id: string;
  tenantId: string;
  uploadedByUserId: string | null;
  visibility: StoredFileVisibility;
  purpose: StoredFilePurpose;
  bucket: string;
  objectKey: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: Date;
}

export interface StoredFileView {
  id: string;
  tenantId: string;
  uploadedByUserId: string | null;
  purpose: StoredFilePurpose;
  visibility: StoredFileVisibility;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  url: string;
}

export interface FileRequestMeta {
  ipAddress: string | null;
  userAgent: string | null;
}

export interface FileActionLogInput {
  tenantId: string | null;
  actorUserId: string;
  action:
    | 'files.upload'
    | 'files.delete'
    | 'profile.avatar_clear'
    | 'company.logo_clear';
  entityType: string;
  metadata: {
    purpose: StoredFilePurpose;
    visibility: StoredFileVisibility;
  };
  ipAddress: string | null;
  userAgent: string | null;
}

export interface NewStoredFile {
  tenantId: string;
  uploadedByUserId: string;
  visibility: StoredFileVisibility;
  purpose: StoredFilePurpose;
  bucket: string;
  objectKey: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
}

export interface FilesDb {
  saveUploadedFile(input: {
    file: NewStoredFile;
    avatarUrl: string | null;
    avatarUserId: string | null;
    logoUrl: string | null;
    logoTenantId: string | null;
    log: FileActionLogInput;
  }): Promise<StoredFileRecord>;
  findInTenant(id: string, tenantId: string): Promise<StoredFileRecord | null>;
  deleteUploadedFile(input: {
    id: string;
    tenantId: string;
    avatarUrlToClear: string | null;
    logoUrlToClear: string | null;
    log: FileActionLogInput;
  }): Promise<StoredFileRecord | null>;
  readUserAvatarUrl(userId: string): Promise<string | null>;
  readTenantLogoUrl(tenantId: string): Promise<string | null>;
  listStoredFiles(input: {
    purpose: StoredFilePurpose;
    tenantId?: string;
    uploadedByUserId?: string;
  }): Promise<StoredFileRecord[]>;
  clearUserAvatarUrl(userId: string): Promise<void>;
  clearTenantLogoUrl(tenantId: string): Promise<void>;
  writeActionLog(
    log: FileActionLogInput,
    entityId: string | null,
  ): Promise<void>;
}

export interface FileStorage {
  putObject(input: {
    bucket: string;
    objectKey: string;
    bytes: Uint8Array;
    contentType: string;
  }): Promise<void>;
  deleteObject(input: { bucket: string; objectKey: string }): Promise<void>;
  publicUrl(objectKey: string): string;
  privateUrl(input: { bucket: string; objectKey: string }): Promise<string>;
  ensureBuckets(): Promise<void>;
}
