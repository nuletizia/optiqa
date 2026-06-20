# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in OptiQA, please **do not open a public
issue**. Instead, email the maintainers privately with:

- a description of the issue and its impact,
- steps to reproduce, and
- any suggested remediation.

We'll acknowledge your report and work with you on a fix and coordinated disclosure.

## Operational security notes for self-hosters

- **Credentials are never committed.** Only `.env.example` is tracked; all real
  secrets live in `.env.local` (gitignored). Rotate any secret you suspect has leaked.
- **AWS keys are server-side only.** They use plain `AWS_*` / `S3_BUCKET_NAME`
  variables (no `NEXT_PUBLIC_` prefix), so they are never bundled into client code.
  Scope the IAM user to the single bucket with least-privilege permissions and rotate
  keys regularly.
- **`NEXT_PUBLIC_DISABLE_AUTH=true` is a dev-only switch** that bypasses all auth.
  Never set it in a deployed environment.
- **Don't commit database dumps.** `*.dump`, `*.sql` backups, and `prod_dump.sql` are
  gitignored; a dump can contain OAuth/session tokens and user emails.
