/**
 * Storage abstraction for job artifacts (video, optimized video, script,
 * diagnostics). LocalStorage (dev) copies files under STORAGE_DIR and the web
 * streams them; S3Storage (prod) uploads and hands out time-limited signed URLs.
 */
import fs from "node:fs";
import path from "node:path";
import { STORAGE_DIR } from "./config";

export interface Storage {
  readonly kind: "local" | "s3";
  /** Store a file already on disk under `key`. */
  putFile(key: string, srcPath: string, contentType: string): Promise<void>;
  /** Local only: read the bytes back (web streams them). */
  getBytes(key: string): Promise<{ data: Buffer; contentType: string } | null>;
  /** S3 only: a time-limited download URL (web 302-redirects to it). */
  presignedGetUrl(key: string, filename: string, contentType: string): Promise<string>;
  delete(key: string): Promise<void>;
}

const CT = new Map<string, string>();

export class LocalStorage implements Storage {
  readonly kind = "local" as const;
  constructor(private dir: string = STORAGE_DIR) {
    fs.mkdirSync(this.dir, { recursive: true });
  }
  private full(key: string) {
    return path.join(this.dir, key.replace(/[^a-zA-Z0-9._/-]/g, "_"));
  }
  async putFile(key: string, srcPath: string, contentType: string): Promise<void> {
    const dest = this.full(key);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(srcPath, dest);
    CT.set(key, contentType);
  }
  async getBytes(key: string): Promise<{ data: Buffer; contentType: string } | null> {
    const dest = this.full(key);
    if (!fs.existsSync(dest)) return null;
    return { data: fs.readFileSync(dest), contentType: CT.get(key) || "application/octet-stream" };
  }
  async presignedGetUrl(): Promise<string> {
    throw new Error("presignedGetUrl is not supported by LocalStorage; stream getBytes instead.");
  }
  async delete(key: string): Promise<void> {
    const dest = this.full(key);
    if (fs.existsSync(dest)) fs.rmSync(dest, { force: true });
  }
}
