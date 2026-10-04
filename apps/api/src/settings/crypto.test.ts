import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret, keyHint, MasterKeyError, requireMasterKey } from "./crypto";

const MASTER = "a".repeat(64);

describe("requireMasterKey", () => {
  it("devuelve un buffer de 32 bytes con master hex 64", () => {
    const key = requireMasterKey(MASTER);
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(32);
  });

  it("lanza MASTER_KEY_MISSING si falta", () => {
    expect(() => requireMasterKey(undefined)).toThrowError(MasterKeyError);
    try {
      requireMasterKey(undefined);
    } catch (error) {
      expect((error as MasterKeyError).code).toBe("MASTER_KEY_MISSING");
    }
  });

  it("lanza MASTER_KEY_INVALID si no es hex 64", () => {
    for (const bad of ["", "abc", "z".repeat(64), `${"a".repeat(63)}`, `${"a".repeat(65)}`]) {
      expect(() => requireMasterKey(bad)).toThrowError(MasterKeyError);
    }
  });
});

describe("encryptSecret / decryptSecret", () => {
  it("round-trip devuelve el secreto original", () => {
    const key = requireMasterKey(MASTER);
    const secret = "sk-or-v1-abcdefghij0123456789";
    const cipher = encryptSecret(secret, key);
    expect(cipher).not.toContain(secret);
    expect(decryptSecret(cipher, key)).toBe(secret);
  });

  it("cada cifrado es distinto (IV aleatorio) pero descifra igual", () => {
    const key = requireMasterKey(MASTER);
    const a = encryptSecret("mismo-secreto", key);
    const b = encryptSecret("mismo-secreto", key);
    expect(a).not.toBe(b);
    expect(decryptSecret(a, key)).toBe("mismo-secreto");
    expect(decryptSecret(b, key)).toBe("mismo-secreto");
  });

  it("falla con tag corrupto", () => {
    const key = requireMasterKey(MASTER);
    const cipher = encryptSecret("secreto", key);
    const raw = Buffer.from(cipher, "base64");
    raw[13] = (raw[13] ?? 0) ^ 0xff;
    expect(() => decryptSecret(raw.toString("base64"), key)).toThrowError(MasterKeyError);
  });

  it("falla con otra master key", () => {
    const cipher = encryptSecret("secreto", requireMasterKey(MASTER));
    expect(() => decryptSecret(cipher, requireMasterKey("b".repeat(64)))).toThrowError(
      MasterKeyError,
    );
  });
});

describe("keyHint", () => {
  it("enmascara dejando los últimos 4", () => {
    expect(keyHint("sk-or-v1-1234abcd")).toBe("••••abcd");
  });
});
