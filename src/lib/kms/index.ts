import crypto from "crypto";
import { env } from "@/lib/env";
import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from "@aws-sdk/client-kms";

const ALGO = "aes-256-gcm";

/**
 * Enterprise KMS Integration Stub.
 * In a real production setup, this would use AWS KMS or an on-prem HSM via API.
 * E.g., `kms.generateDataKey()` and envelope encryption.
 * For this prototype, if AWS_KMS_KEY_ID is not provided, it falls back
 * to using the local ENCRYPTION_KEY environment variable.
 */
export class KMS {
  private fallbackKey: Buffer;
  private kmsClient?: KMSClient;

  constructor() {
    if (env.awsKmsKeyId) {
      this.kmsClient = new KMSClient({ region: process.env.AWS_REGION || "us-east-1" });
      console.log("[KMS] Initialized AWS KMS Envelope Encryption");
    } else {
      console.warn("[KMS] WARNING: AWS_KMS_KEY_ID not set. Falling back to local mock KMS.");
    }
    
    if (!env.encryptionKey || env.encryptionKey.length !== 64) {
      throw new Error("ENCRYPTION_KEY must be exactly 32 bytes (64 hex chars).");
    }
    this.fallbackKey = Buffer.from(env.encryptionKey, "hex");
  }

  /**
   * Encrypts the provided buffer using AES-256-GCM.
   * If AWS_KMS_KEY_ID is set, uses envelope encryption:
   * Format: [Marker:2][CiphertextBlobLength:2][CiphertextBlob][IV:16][AuthTag:16][Ciphertext]
   * If not set, uses local fallback key:
   * Format: [IV:16][AuthTag:16][Ciphertext]
   */
  async encrypt(buffer: Buffer, aad?: string): Promise<Buffer> {
    let dataKey: Buffer;
    let ciphertextBlob = Buffer.alloc(0);
    
    if (this.kmsClient && env.awsKmsKeyId) {
      const command = new GenerateDataKeyCommand({ KeyId: env.awsKmsKeyId, KeySpec: "AES_256" });
      const response = await this.kmsClient.send(command);
      if (!response.Plaintext || !response.CiphertextBlob) {
        throw new Error("Failed to generate data key from KMS");
      }
      dataKey = Buffer.from(response.Plaintext);
      ciphertextBlob = Buffer.from(response.CiphertextBlob);
    } else {
      dataKey = this.fallbackKey;
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGO, dataKey, iv);
    
    if (aad) {
      cipher.setAAD(Buffer.from(aad, 'utf-8'));
    }
    
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const authTag = cipher.getAuthTag();
    
    if (ciphertextBlob.length > 0) {
      const header = Buffer.alloc(4);
      header.writeUInt16BE(0x4B4D, 0); // 'KM' marker
      header.writeUInt16BE(ciphertextBlob.length, 2);
      return Buffer.concat([header, ciphertextBlob, iv, authTag, encrypted]);
    }
    
    return Buffer.concat([iv, authTag, encrypted]);
  }

  /**
   * Decrypts the provided buffer.
   */
  async decrypt(encryptedBuffer: Buffer, aad?: string): Promise<Buffer> {
    let dataKey: Buffer = this.fallbackKey;
    let offset = 0;
    
    // Check for 'KM' marker indicating AWS KMS Envelope Encryption
    if (encryptedBuffer.length > 4 && encryptedBuffer.readUInt16BE(0) === 0x4B4D) {
      if (!this.kmsClient) {
        throw new Error("File is KMS encrypted but AWS_KMS_KEY_ID is not configured");
      }
      const blobLength = encryptedBuffer.readUInt16BE(2);
      offset = 4;
      const ciphertextBlob = encryptedBuffer.subarray(offset, offset + blobLength);
      offset += blobLength;
      
      const command = new DecryptCommand({ CiphertextBlob: ciphertextBlob });
      const response = await this.kmsClient.send(command);
      if (!response.Plaintext) {
        throw new Error("Failed to decrypt data key via KMS");
      }
      dataKey = Buffer.from(response.Plaintext);
    }
    
    const iv = encryptedBuffer.subarray(offset, offset + 16);
    const authTag = encryptedBuffer.subarray(offset + 16, offset + 32);
    const ciphertext = encryptedBuffer.subarray(offset + 32);

    const decipher = crypto.createDecipheriv(ALGO, dataKey, iv);
    decipher.setAuthTag(authTag);
    
    if (aad) {
      decipher.setAAD(Buffer.from(aad, 'utf-8'));
    }
    
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }
}

export const kms = new KMS();
