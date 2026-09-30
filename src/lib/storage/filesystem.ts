import { promises as fs } from "fs";
import path from "path";
import { StorageAdapter } from "./types";
import { env } from "@/lib/env";
import { kms } from "@/lib/kms";

export class FilesystemStorageAdapter implements StorageAdapter {
  private rootDir: string;

  constructor() {
    this.rootDir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), env.storageRoot);
  }

  private async ensureDir() {
    await fs.mkdir(this.rootDir, { recursive: true });
  }

  async put(key: string, buffer: Buffer, mimeType: string, aad?: string) {
    await this.ensureDir();
    const encryptedData = await kms.encrypt(buffer, aad);
    const filePath = path.join(this.rootDir, key);
    await fs.writeFile(filePath, encryptedData);

    return {
      key,
      byteLength: encryptedData.length
    };
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.stat(path.join(this.rootDir, key));
      return true;
    } catch {
      return false;
    }
  }

  async get(key: string, aad?: string): Promise<Buffer> {
    const filePath = path.join(this.rootDir, key);
    const fileData = await fs.readFile(filePath);
    return kms.decrypt(fileData, aad);
  }

  async delete(key: string): Promise<void> {
    try {
      const filePath = path.join(this.rootDir, key);
      await fs.unlink(filePath);
    } catch {
      // Ignore if it doesn't exist
    }
  }
}
