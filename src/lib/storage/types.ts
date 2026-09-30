export type StoredObject = {
  key: string;
  byteLength: number;
};

export interface StorageAdapter {
  put(key: string, bytes: Buffer, contentType: string, aad?: string): Promise<StoredObject>;
  get(key: string, aad?: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
}

/** Filesystem adapter used for local demo. MinIO/S3 adapter is a later swap. */
export const storageAdapterName = process.env.STORAGE_ADAPTER ?? "filesystem";
