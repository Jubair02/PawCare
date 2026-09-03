import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/lib/password";

describe("password hashing", () => {
  it("verifies a correct password and rejects a wrong one", () => {
    const hash = hashPassword("customer123");
    expect(verifyPassword("customer123", hash)).toBe(true);
    expect(verifyPassword("customer124", hash)).toBe(false);
  });

  it("is deterministic, which is what lets the seed script share this module", () => {
    expect(hashPassword("admin123")).toBe(hashPassword("admin123"));
  });

  it("distinguishes different passwords", () => {
    expect(hashPassword("a")).not.toBe(hashPassword("b"));
  });
});
