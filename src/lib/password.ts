import { createHash } from "crypto";

const SALT = "pawcare::v1::";

export function hashPassword(password: string): string {
  return createHash("sha256").update(SALT + password).digest("hex");
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}
