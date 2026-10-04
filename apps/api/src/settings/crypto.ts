import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const IV_BYTES = 12;
const TAG_BYTES = 16;

export class MasterKeyError extends Error {
  constructor(
    readonly code: "MASTER_KEY_MISSING" | "MASTER_KEY_INVALID",
    message: string,
  ) {
    super(message);
    this.name = "MasterKeyError";
  }
}

export function requireMasterKey(masterKey: string | undefined): Buffer {
  if (!masterKey) {
    throw new MasterKeyError(
      "MASTER_KEY_MISSING",
      "La variable DOCUMIND_MASTER_KEY no está definida",
    );
  }
  if (!/^[0-9a-fA-F]{64}$/.test(masterKey)) {
    throw new MasterKeyError(
      "MASTER_KEY_INVALID",
      "La variable DOCUMIND_MASTER_KEY debe ser hex de 64 caracteres (32 bytes)",
    );
  }
  return createHash("sha256").update(Buffer.from(masterKey, "hex")).digest();
}

export function encryptSecret(plain: string, masterKey: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", masterKey, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptSecret(cipher: string, masterKey: Buffer): string {
  const raw = Buffer.from(cipher, "base64");
  if (raw.length <= IV_BYTES + TAG_BYTES) {
    throw new MasterKeyError("MASTER_KEY_INVALID", "El dato cifrado está corrupto");
  }
  const iv = raw.subarray(0, IV_BYTES);
  const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const data = raw.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", masterKey, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    throw new MasterKeyError(
      "MASTER_KEY_INVALID",
      "El dato cifrado no se pudo descifrar con la clave maestra",
    );
  }
}

export function keyHint(apiKey: string): string {
  const tail = apiKey.slice(-4);
  return `••••${tail}`;
}
