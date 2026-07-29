/**
 * S3-compatible storage (MinIO in dev, S3 in prod). Private objects; downloads
 * via time-limited presigned URLs. Loaded only when STORAGE_DRIVER=s3.
 */
import fs from "node:fs";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Storage } from "./storage";

export class S3Storage implements Storage {
  readonly kind = "s3" as const;
  private client: S3Client;
  private bucket: string;
  private ttl: number;
  constructor() {
    this.bucket = process.env.S3_BUCKET || "walkthroughs";
    this.ttl = Number(process.env.S3_SIGNED_TTL || 3600);
    this.client = new S3Client({
      region: process.env.S3_REGION || "us-east-1",
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials:
        process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
          ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }
          : undefined,
    });
  }
  async putFile(key: string, srcPath: string, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: fs.createReadStream(srcPath), ContentType: contentType })
    );
  }
  async getBytes(): Promise<null> {
    return null; // web redirects to a presigned URL instead
  }
  async presignedGetUrl(key: string, filename: string, contentType: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentType: contentType,
        ResponseContentDisposition: `attachment; filename="${filename}"`,
      }),
      { expiresIn: this.ttl }
    );
  }
  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
