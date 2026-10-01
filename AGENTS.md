# AGENTS.md

## Project overview

TalentSpring is a full-stack job portal: Next.js 16 (App Router) frontend, Express/TypeScript modular-monolith API, PostgreSQL + Prisma, Redis (rate limits + BullMQ queue), and SeaweedFS (S3-compatible) for resume/logo storage. Emails go through SendGrid via a separate BullMQ worker process.

## Common commands

### Full stack (Docker)

```sh
cp .env.example .env
docker compose up --build -d
docker compose exec api_backend npm run db:seed
```

App at `http://localhost:3000`, API at `http://localhost:5000/api/v1`, Swagger UI at `/docs`.

### Backend (`backend/`)

```sh
npm run dev          # tsx watch src/server.ts
npm run worker       # BullMQ email worker (separate process, required for email)
npm run typecheck    # tsc --noEmit
npm run build        # tsc -> dist/
npm test             # vitest unit tests (tests/unit/)
npm run test:integration  # vitest integration tests (needs running Postgres + Redis)
npm run db:generate  # prisma generate (run after schema changes)
npm run db:migrate   # prisma migrate dev (dev only — creates migration files)
npm run db:deploy    # prisma migrate deploy (production — applies committed migrations)
npm run db:seed      # tsx prisma/seed.ts
npm run db:erd       # regenerate backend/prisma/ERD.md
```

### Frontend (`frontend/`)

```sh
npm run dev          # next dev -p 3000
npm run build        # next build --webpack
npm run typecheck    # tsc --noEmit
npm run test:e2e     # playwright (needs full seeded stack + Chromium)
```

## Architecture notes

- **API prefix**: all routes are under `/api/v1`. Health probes at `/health/liveness` and `/health/readiness` are outside the prefix.
- **Backend modules** (`backend/src/modules/`): `auth`, `companies`, `profiles`, `jobs`, `applications`, `notifications`, `admin`, `uploads`. Each module has its own routes file. Shared middleware in `backend/src/middleware/`.
- **Email worker is separate**: `npm run worker` runs `src/jobs/email-worker.ts` as a standalone BullMQ consumer. Without it, emails are silently skipped (logged as `email_skipped`). In Docker, the `email_worker` service handles this.
- **Auth**: dual JWT — 15-min access token (Bearer header) + 7-day refresh token (HTTP-only cookie). Refresh tokens are SHA256-hashed in Redis for revocation. JWT secrets must be >= 32 bytes.
- **Frontend API client** (`frontend/src/lib/api.ts`): `apiFetch` auto-retries on 401 by calling `/auth/refresh` once. Uses Zustand store for the access token. Browser calls go to `NEXT_PUBLIC_API_URL`; server-side uses `API_INTERNAL_URL`.
- **Uploads**: presigned S3 PUT URLs via `POST /api/v1/uploads/presigned-url`. Client uploads directly to S3, not through the API.
- **Prisma**: schema at `backend/prisma/schema.prisma`. Migrations are committed in `backend/prisma/migrations/`. Always run `npm run db:generate` after editing the schema. Use `db:migrate` in dev, `db:deploy` in production.
- **Seed data**: creates admin, companies, recruiters, candidates, skills, jobs, and applications. Demo password is `SEED_PASSWORD` env var (default `JobPortal123!`). Never seed production.

## Testing

- **Unit tests** (`backend/tests/unit/`): pure logic, no external services needed.
- **Integration tests** (`backend/tests/integration/`): require running PostgreSQL and Redis. Run `docker compose up -d postgres_db redis_cache` first. Tests run with `fileParallelism: false`.
- **E2E tests** (`frontend/tests/e2e/`): require the full seeded stack and Chromium (`npx playwright install chromium`). Not parallel.

## Environment setup

- Root `.env` is used by Docker Compose. `backend/.env` and `frontend/.env.local` are for local dev without app containers.
- There is no `frontend/.env.example` — create `frontend/.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1`.
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` must each be at least 32 characters.

## Docs

- `architecture.txt` — full architecture spec (1077 lines). Reference for design rationale, not required reading for most tasks.
- `DEPLOYMENT.md` — production deployment guide (Vercel frontend + container API/worker).
- `backend/prisma/ERD.md` — database diagram (regenerate with `npm run db:erd`).
