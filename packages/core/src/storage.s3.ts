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
  private signer: S3Client;
  private bucket: string;
  private ttl: number;
  constructor() {
    this.bucket = process.env.S3_BUCKET || "walkthroughs";
    this.ttl = Number(process.env.S3_SIGNED_TTL || 3600);
    const region = process.env.S3_REGION || "us-east-1";
    const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === "true";
    const credentials =
      process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
        ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }
        : undefined;
    // Server-to-server ops use the internal endpoint (e.g. http://minio:9000).
    this.client = new S3Client({ region, endpoint: process.env.S3_ENDPOINT, forcePathStyle, credentials });
    // Presigned URLs are handed to the browser, which cannot resolve the
    // internal compose hostname — sign against a browser-reachable endpoint.
    // Falls back to the internal endpoint when no public one is configured.
    const publicEndpoint = process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT;
    this.signer =
      publicEndpoint === process.env.S3_ENDPOINT
        ? this.client
        : new S3Client({ region, endpoint: publicEndpoint, forcePathStyle, credentials });
  }
  async putFile(key: string, srcPath: string, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: fs.createReadStream(srcPath), ContentType: contentType })
    );
  }
  async getBytes(): Promise<null> {
    return null; // web redirects to a presigned URL instead
  }
  async getText(key: string): Promise<string | null> {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      return (await res.Body?.transformToString("utf-8")) ?? null;
    } catch {
      return null;
    }
  }
  async presignedGetUrl(key: string, filename: string, contentType: string): Promise<string> {
    return getSignedUrl(
      this.signer,
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
