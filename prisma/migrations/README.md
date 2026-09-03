# Migrations

The schema used to be applied with `prisma db push --accept-data-loss`, which has
no history and no rollback. It is now under migration control.

## Existing database (the current Neon instance)

Its tables already exist but were created by `db push`, so the migration has to be
baselined. Run once:

```bash
npx prisma db push          # bring the live schema up to date (adds the new indexes)
npx prisma migrate resolve --applied 20250901000000_init
```

After that the database and the migration history agree.

## New database

```bash
npx prisma migrate deploy
```

## Day to day

- Schema change: `npx prisma migrate dev --name <what_changed>`
- Deploy: `npx prisma migrate deploy` (never `db push`)

`db:push` remains available for local scratch databases, but it no longer passes
`--accept-data-loss`; use `db:push:force` if you really mean to drop columns.
