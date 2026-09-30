import { StorageAdapter } from "./types";
import { kms } from "@/lib/kms";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, HeadBucketCommand, CreateBucketCommand } from "@aws-sdk/client-s3";

export class S3StorageAdapter implements StorageAdapter {
  private bucket: string;
  private s3: S3Client;

  constructor() {
    this.bucket = process.env.S3_BUCKET || "nyayavault";
    
    this.s3 = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || "",
        secretAccessKey: process.env.S3_SECRET_KEY || ""
      },
      forcePathStyle: true,
    });
    console.log(`[S3 Storage] Initialized S3 Storage Adapter for bucket: ${this.bucket}`);
  }

  private async ensureBucket() {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (err: any) {
      if (err.name === "NotFound" || err.name === "NoSuchBucket" || err.$metadata?.httpStatusCode === 404) {
        console.log(`[S3 Storage] Bucket ${this.bucket} does not exist. Creating it now...`);
        await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
      } else {
        throw err;
      }
    }
  }

  async put(key: string, buffer: Buffer, mimeType: string, aad?: string) {
    await this.ensureBucket();
    const encryptedData = await kms.encrypt(buffer, aad);
    
    const retainUntil = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000); // 180 days

    await this.s3.send(new PutObjectCommand({ 
      Bucket: this.bucket, 
      Key: key, 
      Body: encryptedData, 
      ContentType: "application/octet-stream"
    }));

    return {
      key,
      byteLength: encryptedData.length
    };
  }

  async exists(key: string): Promise<boolean> {
    try { 
      await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key })); 
      return true; 
    } catch { 
      return false; 
    }
  }

  async get(key: string, aad?: string): Promise<Buffer> {
    const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const stream = res.Body as unknown as NodeJS.ReadableStream;
    
    const encryptedData = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on("error", (err) => reject(err));
      stream.on("end", () => resolve(Buffer.concat(chunks)));
    });

    return kms.decrypt(encryptedData, aad);
  }

  async delete(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
