import { createHash } from "crypto";

import { describe, expect, it } from "vitest";

import { hashPassword, isLegacyHash, verifyPassword } from "@/lib/password";

/** Reproduces the old unsalted scheme so migration can be tested. */
const legacy = (pw: string) => createHash("sha256").update("pawcare::v1::" + pw).digest("hex");

describe("bcrypt hashing", () => {
  it("produces a bcrypt hash, not a bare digest", async () => {
    const hash = await hashPassword("customer123");
    expect(hash.startsWith("$2")).toBe(true);
    expect(isLegacyHash(hash)).toBe(false);
  });

  it("salts per call, so identical passwords do not share a hash", async () => {
    const [a, b] = await Promise.all([hashPassword("customer123"), hashPassword("customer123")]);
    expect(a).not.toBe(b);
  });

  it("verifies the right password and rejects the wrong one", async () => {
    const hash = await hashPassword("customer123");
    expect((await verifyPassword("customer123", hash)).ok).toBe(true);
    expect((await verifyPassword("customer124", hash)).ok).toBe(false);
  });

  it("does not ask for a rehash when already bcrypt", async () => {
    const hash = await hashPassword("customer123");
    expect((await verifyPassword("customer123", hash)).needsRehash).toBe(false);
  });
});

describe("legacy SHA-256 migration", () => {
  it("still lets an un-migrated account log in", async () => {
    const result = await verifyPassword("customer123", legacy("customer123"));
    expect(result.ok).toBe(true);
  });

  it("flags a successful legacy login for rehashing", async () => {
    const result = await verifyPassword("customer123", legacy("customer123"));
    expect(result.needsRehash).toBe(true);
  });

  it("rejects a wrong password against a legacy hash without flagging a rehash", async () => {
    const result = await verifyPassword("wrong", legacy("customer123"));
    expect(result).toEqual({ ok: false, needsRehash: false });
  });

  it("recognises the legacy format", () => {
    expect(isLegacyHash(legacy("x"))).toBe(true);
    expect(isLegacyHash("$2b$12$abcdefghijklmnopqrstuv")).toBe(false);
    expect(isLegacyHash("")).toBe(false);
  });
});

describe("malformed input", () => {
  it("fails closed on an empty or garbage stored hash", async () => {
    expect((await verifyPassword("anything", "")).ok).toBe(false);
    expect((await verifyPassword("anything", "not-a-hash")).ok).toBe(false);
  });
});
