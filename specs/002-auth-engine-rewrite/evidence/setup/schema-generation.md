# Schema generation evidence

`bunx auth@1.7.6 generate --help` completed successfully and confirmed support
for `--config`, `--output`, `--adapter`, and `--dialect`. The stable repository
command is:

```powershell
bun run auth:schema
```

It targets `src/db/auth-schema.ts`. Generation will run only after the reviewed
Better Auth plugin configuration exists; every generated schema and migration
diff must be reviewed before use.

## Drizzle migration policy

- Treat `src/db/schema.ts` and `src/db/auth-schema.ts` as the source of truth for
  tables, columns, enums, indexes, foreign keys, and schema-level constraints.
- Do not commit locally generated schema migrations for ordinary feature work.
  After the schema change reaches `master`, `.github/workflows/migrations.yaml`
  runs `bun run db:generate` once and commits the resulting migration artifacts.
- Production applies the CI-generated committed migration through the established
  deployment path. Never execute migration SQL manually against production.
- Handwritten SQL is limited to database behavior that Drizzle cannot express,
  such as PostgreSQL trigger functions. It requires a separate, explicit review;
  do not mix it into locally generated migration output or apply it manually.
- `bun run db:push` is permitted only for the disposable development database.
  The script obtains its development connection through Infisical; it is not a
  production migration or cutover mechanism.

The auth cutover program performs data backfill and validation. It does not
replace Drizzle's schema migration journal and must not issue ad-hoc production
schema DDL.

Repository enforcement blocks ordinary feature-branch migration generation at
the command and pre-commit boundaries. A custom migration requires explicit
human approval through the one-commit `CLIPIFY_MANUAL_MIGRATION_APPROVED`
override; agents must not grant that approval themselves.
