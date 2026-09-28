import { mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const MIME_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export type StoredFile = { storagePath: string; sizeBytes: number };

export class FileStorage {
  constructor(private readonly rootDir: string) {}

  async save(buffer: Buffer, mime: string): Promise<StoredFile> {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const dir = path.join(this.rootDir, month);
    await mkdir(dir, { recursive: true });
    const ext = MIME_EXT[mime] ?? "bin";
    const relative = path.join(month, `${randomUUID()}.${ext}`);
    const absolute = path.join(this.rootDir, relative);
    await mkdir(path.dirname(absolute), { recursive: true });
    const { writeFile } = await import("node:fs/promises");
    await writeFile(absolute, buffer);
    return { storagePath: relative, sizeBytes: buffer.length };
  }

  absolutePath(storagePath: string): string {
    return path.join(this.rootDir, storagePath);
  }
}
