# Migrations

The schema used to be applied with `prisma db push --accept-data-loss`, which has
no history and no rollback. It is now under migration control.

## Existing database (the current Neon instance)

Its tables already exist but were created by `db push`, so the migrations have to
be baselined. Run once:

```bash
npm run db:baseline
```

which is:

```bash
npx prisma db push          # bring the live schema up to date (adds the new indexes
                            # and the Session table)
npx prisma migrate resolve --applied 20250901000000_init
npx prisma migrate resolve --applied 20250902000000_add_sessions
```

After that the database and the migration history agree.

Every migration already represented in the live schema must be resolved, not just
the first. `db push` creates the `Session` table without recording
`20250902000000_add_sessions`, so skipping that second `resolve` leaves a later
`migrate deploy` trying to `CREATE TABLE "Session"` a second time, which fails.

Until `Session` exists, **every login fails**: the password check passes and then
`createSession()` cannot write its row, so `/api/auth/login` returns a 500 and the
UI shows "Something went wrong. Please try again.".

## New database

```bash
npx prisma migrate deploy
```

## Day to day

- Schema change: `npx prisma migrate dev --name <what_changed>`
- Deploy: `npx prisma migrate deploy` (never `db push`)

`db:push` remains available for local scratch databases, but it no longer passes
`--accept-data-loss`; use `db:push:force` if you really mean to drop columns.
