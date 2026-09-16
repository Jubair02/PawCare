import { db } from "@/lib/db";
import { describeDbFailure, json } from "@/lib/auth";

/**
 * Deployment health check — the fastest way to tell a broken *deployment* from
 * a broken *build*.
 *
 * Every database-backed route funnels its failures through `handleError`, which
 * deliberately returns a generic message so nothing leaks to the public. That
 * is right for users and useless for whoever has to fix the deployment: a
 * missing environment variable and an un-migrated database produce identical
 * 500s. This endpoint reports which one it is.
 *
 * Deliberately unauthenticated: it has to work on a deployment where logging in
 * is exactly what is broken. It reports only booleans and a failure code — never
 * the connection string, credentials or host.
 */

// Never prerender or cache: the whole point is the state of this instance now.
export const dynamic = "force-dynamic";

export async function GET() {
  const env = {
    databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
    directUrlConfigured: Boolean(process.env.DIRECT_URL),
  };

  // 1. Can we reach the database at all?
  try {
    await db.$queryRaw`SELECT 1`;
  } catch (e) {
    const failure = describeDbFailure(e);
    console.error("[health] database unreachable", e);
    return json(
      {
        status: "error",
        ...env,
        database: "unreachable",
        code: failure?.code ?? "DB_ERROR",
        hint:
          failure?.hint ??
          "The database could not be queried. Check DATABASE_URL in this environment.",
      },
      503
    );
  }

  // 2. Is the schema the one this build expects? `Session` is the table that
  //    login writes to, and the one that was missing the last time login broke.
  try {
    await db.session.count();
  } catch (e) {
    const failure = describeDbFailure(e);
    console.error("[health] schema check failed", e);
    return json(
      {
        status: "error",
        ...env,
        database: "reachable",
        sessionTable: "missing",
        code: failure?.code ?? "DB_SCHEMA_OUTDATED",
        hint: "Connected, but the Session table is missing. Run `npm run db:baseline` against this database.",
      },
      503
    );
  }

  return json({
    status: "ok",
    ...env,
    database: "reachable",
    sessionTable: "present",
  });
}
