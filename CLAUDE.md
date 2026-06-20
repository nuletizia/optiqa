# CLAUDE.md

Guidance for working in this repository.

## What this is

**OptiQA** (package name `optiqa`, "Image Quality Assessment Tool — by PiktID") is an
internal web tool for **measuring the quality of batches of images and comparing two
versions of a batch against each other**, using a pairwise "image-arena" style rating
mechanism (similar to how LMArena/Chatbot-Arena ranks models via head-to-head votes).

The core idea: quality assessment is a hard, subjective task, so instead of scoring images
on an absolute scale, approved members of an **organization** are shown **pairs of images**
(version 1 vs version 2) and pick the better one (or a tie). Each vote updates a
**Bradley-Terry / Elo-style strength score** per directory (version). After enough votes the
aggregate score reveals which batch/version is higher quality.

It was built ~early 2025 as an internal PiktID tool. Treat it as a working but
lightly-maintained internal app, not a polished product.

## Tech stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS** + **shadcn/ui** (Radix primitives) — components in `src/components/ui/`
- **Prisma 6** ORM over **PostgreSQL**
- **NextAuth v5 (beta)** with **Google** OAuth provider, JWT session strategy
- **AWS S3** for image storage (presigned URLs for upload, list/get for browsing)
- **Vercel KV** (`@vercel/kv`) — present as a dependency; used for some async operation state
- **chart.js** / `react-chartjs-2` for ratings histograms/visualizations
- Deployed on **Vercel** (there is a local DB and a production DB, see scripts)

## Common commands

```bash
npm run dev        # next dev (local dev server on :3000)
npm run dev --host # expose on local network
npm run build      # prisma generate && next build (strict: type + lint errors fail it)
npm run start      # next start (production)
npm run lint       # next lint
npm run typecheck  # tsc --noEmit
npm test           # vitest unit tests (src/lib/*.test.ts)
npx prisma generate   # regenerate Prisma client after schema changes
npx prisma migrate dev / npx prisma db push   # apply schema to DB
```

Local Postgres (macOS / Homebrew):
```bash
pg_isready -h localhost -p 5432
brew services start postgresql@15
brew services stop postgresql@15
```

Note: `next.config.js` sets `eslint.ignoreDuringBuilds` and `typescript.ignoreBuildErrors`
to **false** — the build **does** fail on type errors and lint *errors*. Legacy/stylistic
lint rules (`no-explicit-any`, `no-unused-vars`, unescaped entities, exhaustive-deps) are
configured as **warnings** in `eslint.config.mjs` so they surface without blocking the build.

## Architecture & key concepts

### Domain model (`prisma/schema.prisma`)
- **User** — authenticated via Google. Belongs to organizations via `UserOrganization`.
- **Organization** — the access-control boundary. Only **approved members** of an org can
  evaluate and see that org's ratings. Org name maps to an S3 prefix (lowercased).
- **UserOrganization** — join table with the important flags:
  - `isApprovedMember` — gates access to evaluation/ratings.
  - `isCurrentSession` — which org the user is "acting as" right now (a user can be in
    multiple orgs but only one is active). Auth and almost every API filters on
    `isCurrentSession = true AND isApprovedMember = true`.
  - `isAdmin` — org admin (manage members, folders, invite codes, reset ratings).
- **OrganizationInviteCode** — invite-code-gated joining (see `INVITE_CODE_SYSTEM.md`).
  Users with a valid code are auto-approved; orgs are no longer publicly listed.
- **DirectoryRating** — the heart of the scoring system. One row per
  (user, organization, directory/version) holding the Bradley-Terry `rating` (strength) and
  number of `comparisons`. Keyed by `product` + `version` + `directoryPath`. "Global"
  ratings are aggregated across users in the org.
- **ComparisonResult** — a saved record of a full comparison run (v1 vs v2, scores,
  `detailedResults` JSON string).
- **ComparisonSet** — a named, preset pair of directories (v1 vs v2) an admin sets up for
  members to evaluate, instead of members picking folders ad-hoc.
- **RenameOperation** — tracks long-running S3 folder rename jobs (async, with progress).

### Image storage layout (S3)
Images live under: `{organization}/{product}/{version}/...` in the bucket. The app lists
"products" and "versions" (directories) from S3 to build comparison pairs. Org name is
lowercased to form the prefix.

### The rating algorithm (`src/components/ImageComparison/hooks/useBradleyTerry.ts`)
- Bradley-Terry / Elo hybrid. Each entity starts at strength **1000**, `K = 32`.
- On a win: `expectedProb = winner / (winner + loser)`; `change = K * (1 - expectedProb)`;
  winner gains, loser loses (floored at 1).
- Ties use half the K factor and pull both toward their expected probability.
- Scores are tracked per `id` (typically `v1` / `v2`, the two versions being compared).

### Comparison flow (`src/components/ImageComparison/`)
- `index.tsx` → `ComparisonInterface.tsx` is the main evaluation UI.
- Setup: `SetupModeSelection` → either `DirectorySetup` (pick folders ad-hoc) or
  `PresetDirectorySetup` (use an admin-defined `ComparisonSet`).
- Hooks:
  - `useImageComparison.ts` — orchestrator: loads files (from S3 or local
    `showDirectoryPicker`), generates all v1×v2 pairs (Fisher-Yates shuffled), tracks
    current pair, records winners/ties.
  - `useBradleyTerry.ts` — scoring (above).
  - `useRatingsStorage.ts` — persists/loads ratings to the DB via the ratings API.
  - `useZoomPan.ts` — image zoom/pan for close inspection.
- Supports **mask overlays** (compare against a reference image; see `isMask`/`referenceUrl`
  in `types.ts`) and a **tie** option.
- `RatingsHistogram.tsx` visualizes the score distribution.

### Shared library layer (`src/lib/`)
Common logic is centralized here (was previously copy-pasted across routes/components):
- `auth/organization.ts` — `getActiveOrganization(userId)`, the single source of truth for
  resolving a user's active+approved org (`isCurrentSession = true AND isApprovedMember = true`).
  **Use this everywhere**; do not re-inline the raw SQL.
- `s3.ts` — the server S3 client + helpers (`listCommonPrefixes`, `listObjects`,
  `countImages`, `getPresignedUploadUrl`, `getPresignedDownloadUrl`). Reads **server-only**
  `AWS_*` / `S3_BUCKET_NAME` env vars. All S3 access goes through here.
- `directories.ts` — `listVersionDirectories(org)` and `listDirectoryImages(path, product)`
  (the `org/product/version` traversal + presigned image URLs).
- `paths.ts` — `normalizeDirectoryPath` / `parseDirectoryPath` (tested in `paths.test.ts`).
- `rating.ts` — pure Bradley-Terry/Elo math (`applyWin`, `applyTie`), tested in `rating.test.ts`.
- `logger.ts` — level-gated logger (`LOG_LEVEL`); use instead of `console.log`. Never log tokens/PII.
- `prisma.ts` — Prisma singleton.

### API routes (`src/app/api/`)
- `ratings/` — read/write `DirectoryRating` (the per-user/global scores).
- `comparisons/` — saved `ComparisonResult` history for the current user.
- `organization/` — the bulk of admin functionality: create org, manage members, invite
  codes (`invite/validate`, `invite/join`), list products/directories from S3
  (`products`, `directories`, `directories/files` for presigned image URLs), presigned
  upload URLs (`upload/presigned`), comparison sets, folder rename/list, and ratings reset.
- `user/memberships/` — manage a user's org memberships (remove, toggle admin).
- `auth/[...nextauth]` — NextAuth handler; `auth/check`, `auth/callback` helpers.

All org-scoped routes resolve the active organization via `getActiveOrganization` from
`@/lib/auth/organization` (one place — update the membership rule there).

> The legacy `db-export` / `db-migrate` / `db-setup` and `ratings/cleanup` / `ratings/migrate`
> maintenance endpoints were **removed** during the open-source refactor (they had
> hardcoded-email auth and/or operated on a legacy schema). Browser-side S3 access was also
> removed: client components now call the server `directories` endpoints instead of holding
> AWS credentials.

### Auth (`src/auth.ts`, `src/middleware.ts`)
- Google OAuth, JWT sessions (30-day maxAge). The JWT/session callbacks enrich the token
  with `id`, `organizationId`, `isApprovedMember`, `isCurrentSession` from `UserOrganization`.
- `middleware.ts` protects all routes except a public allowlist (`/`, `/auth`, `/api/auth`,
  `/comparison`, static assets). It only checks for the presence of the session cookie.
- `NEXT_PUBLIC_DISABLE_AUTH=true` bypasses auth entirely (dev only).
- The `/comparison` page is intentionally public (works without sign-in, but you must be
  signed in + approved to persist to global ratings).

## Environment variables

Copy `.env.example` → `.env.local`. The full set the app uses:
- `DATABASE_URL`, `PRODUCTION_DATABASE_URL` — Postgres connection strings
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME` — S3
  (**server-side only**, read by `src/lib/s3.ts`)
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL` — NextAuth
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google OAuth
- `KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN` — Vercel KV
- `LOG_LEVEL`, `NEXT_PUBLIC_MIN_COMPARISONS`, `NEXT_PUBLIC_DISABLE_AUTH` — flags

AWS credentials are **server-side only** (no `NEXT_PUBLIC_` prefix), so S3 keys are never
bundled into the client — all S3 access happens in API routes via `src/lib/s3.ts`. (The
original build leaked these with a `NEXT_PUBLIC_` prefix; that was fixed in the
open-source refactor.) **Never commit real values**; `.env*` (except `.env.example`) is gitignored.

## Scripts & migrations

- `scripts/` (TypeScript, run with `npx tsx`):
  - `setup-admin.ts <email>` — grant a user admin + approved-member access to all orgs
    (email via arg or `ADMIN_EMAIL`).
  - `copy-prod-to-local.sh` — pg_dump prod → local (reads `PRODUCTION_DATABASE_URL`; no
    hardcoded creds).
  - `reset-prod-ratings.ts` — wipe all `DirectoryRating` rows in prod (destructive).
- `prisma/` — `schema.prisma`, `migrations/` (the real migration history), `seed.ts`
  (seeds an org named by `SEED_ORGANIZATION`, default `Demo`).

> The historical one-off tooling — top-level `migrations/` Python scripts, the
> `prisma/migrate-*.ts` scripts, `copy-local-to-prod.ts`, the committed DB dump, and
> `production_migration.sql` — was **removed** during the open-source refactor.

## Testing

- Vitest unit tests live next to the code as `src/lib/*.test.ts` (currently `rating.test.ts`
  and `paths.test.ts`). Run with `npm test`. Add tests for pure logic you extract into `src/lib/`.

## Conventions & gotchas

- **Raw SQL via `prisma.$queryRaw`** is used heavily (especially for `UserOrganization`
  lookups) instead of the typed Prisma API. Watch quoting of `"camelCase"` column names.
- Use the **`logger`** (`src/lib/logger.ts`) instead of `console.log`; never log tokens/PII.
  (Auth callbacks used to log full JWTs/sessions — that was removed.)
- The build is **strict** (type + lint errors fail it). Stylistic lint rules are warnings.
- Directory path normalization (trailing slashes, `org/product/version`) is fiddly; the
  canonical, tested implementation is `normalizeDirectoryPath` in `src/lib/paths.ts`.
- `.DS_Store` noise — ignored via `.gitignore`.

## Where to start for common tasks

- Change the scoring math → `src/lib/rating.ts` (pure; tested) + `hooks/useBradleyTerry.ts` (wrapper)
- Change the evaluation UI → `src/components/ImageComparison/ComparisonInterface.tsx`
- Change how pairs are built / files loaded → `hooks/useImageComparison.ts`
- Add/adjust an org admin feature → `src/components/organization/*` + `src/app/api/organization/*`
- Change auth / membership rules → `src/auth.ts` + `src/lib/auth/organization.ts`
- Change S3 / directory listing → `src/lib/s3.ts` + `src/lib/directories.ts`
- Change the data model → `prisma/schema.prisma` (then `npx prisma generate`)
