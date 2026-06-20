# Contributing to OptiQA

Thanks for your interest in improving OptiQA! This is a lightly-maintained internal
tool that was opened up as a starting point for others — contributions that keep it
simple and self-hostable are very welcome.

## Getting started

1. Fork and clone the repo.
2. `npm install`
3. Copy `.env.example` → `.env.local` and fill in values (see the README).
4. **Fastest path** (mise + Docker Desktop): `mise run dev` starts a Dockerized Postgres,
   applies the schema, and runs the app. Or without mise: `npm run dev:local`.
5. **Manual path** (your own Postgres): `npx prisma generate && npx prisma db push`, then `npm run dev`.

## Before opening a pull request

Run the full check suite locally — these are the same checks CI runs:

```bash
npm run lint        # ESLint (errors fail; legacy style rules are warnings)
npm run typecheck   # tsc --noEmit (must be clean)
npm test            # vitest unit tests
npm run build       # production build (strict: type + lint errors fail it)
```

## Conventions

- **TypeScript everywhere.** The build enforces types (`typescript.ignoreBuildErrors`
  is `false`). Prefer real types over `any`.
- **No secrets in code or commits.** S3/DB/auth credentials come from env vars only.
  Server-side AWS access goes through `src/lib/s3.ts`; never reintroduce `NEXT_PUBLIC_AWS_*`.
- **Shared helpers live in `src/lib/`** — organization auth (`auth/organization.ts`),
  S3 (`s3.ts`), directory traversal (`directories.ts`), path normalization (`paths.ts`),
  rating math (`rating.ts`), logging (`logger.ts`). Reuse them instead of re-implementing.
- **Use the `logger`** (`src/lib/logger.ts`) rather than `console.log`; never log tokens or PII.
- **Add tests** for pure logic (see `src/lib/*.test.ts`).

## Project layout

See [CLAUDE.md](./CLAUDE.md) for an architecture overview (domain model, rating
algorithm, comparison flow, API routes, auth).
