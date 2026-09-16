import { afterEach, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";

import { ApiError, describeDbFailure } from "@/lib/auth";

/**
 * Login has broken in production twice for environmental reasons that both
 * surfaced as the same opaque 500. These cases pin the classifier that tells
 * them apart, using the real Prisma messages captured against the live Neon
 * host, so a future Prisma upgrade that rewords them fails here rather than in
 * production.
 */

function initError(message: string) {
  return new Prisma.PrismaClientInitializationError(message, "6.0.0");
}

const originalUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalUrl;
});

describe("describeDbFailure", () => {
  it("returns null for ordinary application errors", () => {
    expect(describeDbFailure(new ApiError("Invalid email or password.", 401))).toBeNull();
    expect(describeDbFailure(new Error("something unrelated"))).toBeNull();
  });

  it("reports an unset DATABASE_URL ahead of any message parsing", () => {
    delete process.env.DATABASE_URL;
    const result = describeDbFailure(initError("Authentication failed against database server"));
    expect(result?.code).toBe("DB_NOT_CONFIGURED");
  });

  it("flags a value pasted with its surrounding quotes", () => {
    process.env.DATABASE_URL = '"postgresql://user:pw@host/db"';
    const result = describeDbFailure(
      initError("error: Error validating datasource `db`: the URL must start with the protocol `postgresql://`")
    );
    expect(result?.code).toBe("DB_URL_MALFORMED");
    expect(result?.hint).toMatch(/double quotes/i);
  });

  it("flags rejected credentials", () => {
    process.env.DATABASE_URL = "postgresql://user:pw@host/db";
    const result = describeDbFailure(
      initError(
        "Authentication failed against database server, the provided database credentials for `(not available)` are not valid."
      )
    );
    expect(result?.code).toBe("DB_AUTH_REJECTED");
  });

  it("flags an unresponsive host", () => {
    process.env.DATABASE_URL = "postgresql://user:pw@host/db";
    expect(describeDbFailure(initError("Can't reach database server at `host`:`5432`"))?.code).toBe(
      "DB_UNREACHABLE"
    );
  });

  it("falls back to a generic code for an unrecognised message", () => {
    process.env.DATABASE_URL = "postgresql://user:pw@host/db";
    expect(describeDbFailure(initError("some future prisma wording"))?.code).toBe("DB_UNAVAILABLE");
  });

  it("flags a schema that is behind the code", () => {
    const missingTable = new Prisma.PrismaClientKnownRequestError("table does not exist", {
      code: "P2021",
      clientVersion: "6.0.0",
    });
    expect(describeDbFailure(missingTable)?.code).toBe("DB_SCHEMA_OUTDATED");
  });

  it("leaks no connection details in the hint", () => {
    process.env.DATABASE_URL = "postgresql://user:sup3rsecret@db.example.com/neondb";
    const result = describeDbFailure(
      initError("Authentication failed against database server at db.example.com")
    );
    expect(result?.hint).not.toMatch(/sup3rsecret|db\.example\.com/);
  });
});
