# OptiQA — Image Quality Assessment Tool (by PiktID)

OptiQA is an internal tool for **measuring the quality of batches of images and comparing
two versions of a batch against each other**. Rather than scoring images on an absolute
scale (which is unreliable for a subjective task like image quality), it uses a **pairwise,
image-arena-style mechanism**: approved members of an organization are shown pairs of images
(version 1 vs version 2), pick the better one (or call a tie), and each vote updates a
**Bradley-Terry / Elo-style strength score**. After enough votes, the aggregate score
reveals which version/batch is higher quality.

This is conceptually similar to how LMArena / Chatbot Arena ranks models through head-to-head
votes — applied here to image batches.

> Originally developed as an internal PiktID tool starting **January 2025**; published as
> open source in **2026** after a security review and refactor (credential removal,
> server-side S3 access, shared library layer, tests, and a strict build).

## Key features

- **Pairwise comparison UI** with zoom/pan for close inspection, tie support, and optional
  mask/reference-image overlays.
- **Bradley-Terry / Elo scoring** per directory (version), aggregated per user and globally
  across an organization.
- **Organization-scoped access** — only approved members of an org can evaluate and see that
  org's ratings. Joining is gated by invite codes (see `INVITE_CODE_SYSTEM.md`).
- **Comparison sets** — admins can predefine v1-vs-v2 directory pairs for members to evaluate.
- **S3-backed image storage** browsed by `organization/product/version` folder structure.
- **Ratings dashboards & histograms** to inspect score distributions and history.

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind + shadcn/ui · Prisma 6 +
PostgreSQL · NextAuth v5 (Google OAuth) · AWS S3 · Vercel KV · chart.js. Deployed on Vercel.

For an architectural deep-dive (domain model, rating algorithm, comparison flow, API routes,
auth), see **[CLAUDE.md](./CLAUDE.md)**.

## Prerequisites

- Node.js 18+ (repo predates current LTS; modern Node works)
- PostgreSQL (local via Homebrew `postgresql@15`, or a hosted DB)
- An AWS account with an S3 bucket
- Google OAuth credentials (for sign-in)

## Quick start (one command, Dockerized DB)

If you have [mise](https://mise.jdx.dev) and Docker Desktop, you don't need to install or
manage Postgres yourself — a containerized DB is started, migrated, and torn down for you:

```bash
cp .env.example .env.local   # then add your AWS / Google / NextAuth values
npm install
mise install                 # installs the pinned Node version
mise run dev                 # starts the DB container, applies the schema, runs the app
mise run stop                # stops the DB container when you're done
```

`mise run dev` → http://localhost:3000. The default `DATABASE_URL` in `.env.example` already
matches the bundled `docker-compose.yml` database. Other handy tasks: `mise run db-reset`
(wipe + recreate the DB), `mise run check` (lint + typecheck + test + build).

Prefer plain npm (still Dockerized DB, no mise)?

```bash
npm run dev:local   # docker compose up --wait db && prisma generate && db push && next dev
npm run db:down     # stop the DB container
```

> Requires Docker Desktop to be running. If you'd rather use a local/hosted Postgres instead
> of Docker, skip these and follow the manual setup below.

## Setup (manual / bring-your-own Postgres)

1. Install dependencies:
   ```bash
   npm install   # runs `prisma generate` via postinstall
   ```

2. Configure environment:
   ```bash
   cp .env.example .env.local
   ```
   Then fill in `.env.local`. Required variables:
   - `DATABASE_URL` — Postgres connection string
   - `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME` — S3
     (server-side only; **never** `NEXT_PUBLIC_`-prefixed, so the keys stay out of the
     client bundle)
   - `NEXTAUTH_SECRET`, `NEXTAUTH_URL` — NextAuth
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google OAuth
   - Optional: `KV_*` (Vercel KV), `LOG_LEVEL`, `NEXT_PUBLIC_MIN_COMPARISONS`,
     `NEXT_PUBLIC_DISABLE_AUTH=true` (bypass auth in dev only)

3. Set up the database:
   ```bash
   # ensure Postgres is running
   pg_isready -h localhost -p 5432    # brew services start postgresql@15

   npx prisma generate
   npx prisma db push    # or: npx prisma migrate dev
   ```

4. Run the dev server:
   ```bash
   npm run dev           # http://localhost:3000
   npm run dev --host    # expose on the local network
   ```

## Scripts

```bash
npm run dev        # development server (assumes a DB is already running)
npm run dev:local  # start Dockerized DB + migrate + dev server (one command)
npm run db:up      # start the Docker DB; db:down to stop; db:reset to wipe + recreate
npm run build      # prisma generate && next build (strict: type + lint errors fail it)
npm run start      # production server
npm run lint       # next lint
npm run typecheck  # tsc --noEmit
npm test           # vitest unit tests (rating math, path normalization)
```

(With mise: `mise run dev`, `mise run stop`, `mise run db-reset`, `mise run check`.)

The production build enforces types and lint errors (`next.config.js` sets
`ignoreBuildErrors`/`ignoreDuringBuilds` to `false`). Stylistic/legacy lint rules are
warnings so they don't block the build; genuine correctness rules fail it.

Useful admin/data scripts live in `scripts/` and `prisma/` (e.g. `setup-admin.ts`,
`copy-prod-to-local.sh`, `reset-prod-ratings.ts`). Read them before running — several touch
production data.

## Security notes

- **AWS credentials are server-side only** (`AWS_*` / `S3_BUCKET_NAME`, no `NEXT_PUBLIC_`
  prefix). All S3 access goes through `src/lib/s3.ts` and server API routes, so keys are
  never bundled into client code.
- **Never commit real credentials.** All `.env*` files except `.env.example` are gitignored.
  Database dumps (`*.dump`, `*.sql` backups) are gitignored too — they can contain tokens/PII.
- Use an IAM user scoped to the single S3 bucket with least-privilege permissions; rotate
  keys regularly; enable bucket encryption and CORS for your domain.
- See [SECURITY.md](./SECURITY.md) for how to report vulnerabilities.

## License

MIT
