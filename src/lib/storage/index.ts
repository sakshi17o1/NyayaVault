import { FilesystemStorageAdapter } from "./filesystem";
import { storageAdapterName, type StorageAdapter } from "./types";

let adapterInstance: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (!adapterInstance) {
    // Easily extensible for AWS S3, MinIO, etc. based on STORAGE_ADAPTER env var
    if (process.env.STORAGE_ADAPTER === "s3") {
      const { S3StorageAdapter } = require("./s3");
      adapterInstance = new S3StorageAdapter();
    } else {
      // Fallback to filesystem
      adapterInstance = new FilesystemStorageAdapter();
    }
  }
  return adapterInstance!;
}

export * from "./types";
