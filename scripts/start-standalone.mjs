/**
 * Starts the standalone production server.
 *
 * Replaces `NODE_ENV=production bun .next/standalone/server.js`, whose inline
 * env-var prefix is POSIX-shell syntax and fails on Windows. Runs under node or
 * bun equally — `bun scripts/start-standalone.mjs` works the same way.
 */
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

process.env.NODE_ENV = "production";

const server = path.join(process.cwd(), ".next", "standalone", "server.js");

try {
  await access(server, constants.F_OK);
} catch {
  console.error("✗ .next/standalone/server.js is missing. Run `npm run build` first.");
  process.exit(1);
}

await import(pathToFileURL(server).href);
