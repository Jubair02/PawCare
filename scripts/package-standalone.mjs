/**
 * Copies the assets `next build --output standalone` leaves behind.
 *
 * This used to be `cp -r ...` chained into the npm script, which only works in a
 * POSIX shell — it failed on Windows, where this project is developed.
 */
import { cp, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");

async function exists(p) {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(standalone))) {
  console.error("✗ .next/standalone is missing. Run `next build` first (output: 'standalone').");
  process.exit(1);
}

const copies = [
  [path.join(root, ".next", "static"), path.join(standalone, ".next", "static")],
  [path.join(root, "public"), path.join(standalone, "public")],
];

for (const [from, to] of copies) {
  if (!(await exists(from))) {
    console.warn(`- skipped ${path.relative(root, from)} (not present)`);
    continue;
  }
  await cp(from, to, { recursive: true });
  console.log(`✓ ${path.relative(root, from)} → ${path.relative(root, to)}`);
}
