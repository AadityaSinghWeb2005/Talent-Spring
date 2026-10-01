# TalentSpring Job Portal

A full stack job portal for candidates, recruiters, and platform administrators. The app uses a Next.js App Router frontend, a modular Express/TypeScript API, PostgreSQL with Prisma, Redis for rate limits and background work, and SeaweedFS for local S3 compatible resume storage.

## Run the complete app

Requirements: Docker Compose (or Podman Compose) and 4 GB of available memory.

```sh
cp .env.example .env
docker compose up --build -d
docker compose exec api_backend npm run db:seed
```

Open the web app at [http://localhost:3000](http://localhost:3000). The API is at `http://localhost:5000/api/v1`; the local S3 endpoint is at `http://localhost:9000`.

The seed command is for local development. It creates four roles, the demo administrator, two companies, four recruiters, five candidates, ten skills, five active jobs, candidate profiles/resumes, and sample applications. Demo accounts share the password in `SEED_PASSWORD` (default `JobPortal123!`):

- Admin: `admin@jobportal.com`
- Recruiters: `recruiter1@jobportal.com` through `recruiter4@jobportal.com`
- Candidates: `candidate1@jobportal.com` through `candidate5@jobportal.com`

Set `SENDGRID_API_KEY` and `EMAIL_FROM` in `.env` to send notification emails. Without a SendGrid key, in-app notifications still work and the worker logs that email delivery is skipped.

## Local development without app containers

```sh
cp .env.example backend/.env
cp frontend/.env.example frontend/.env.local
docker compose up -d postgres_db redis_cache object_storage
cd backend && npm ci && npm run db:generate && npm run db:migrate && npm run db:seed
```

In separate terminals, run `cd backend && npm run dev`, `cd backend && npm run worker`, and `cd frontend && npm ci && npm run dev`.

## Main flows

- Candidates register, build a profile, upload a PDF/DOCX resume, search and save jobs, apply, track status changes, receive notifications, and review interviews.
- Recruiters register, create a company, post and manage jobs, review applicants, add private notes, update pipeline stages, download authorized resumes, and schedule interviews.
- Administrators review platform metrics, users, company verification, and audit activity.

## Project commands

Backend (`backend/`): `npm run typecheck`, `npm run build`, `npm run db:migrate`, `npm run db:deploy`, `npm run db:seed`, `npm run worker`.

Frontend (`frontend/`): `npm run typecheck`, `npm run build`, `npm run dev`.

Health probes are `GET /health/liveness` and `GET /health/readiness`. Prisma migrations are committed in `backend/prisma/migrations/`; production startup applies them with `prisma migrate deploy`.

The API reference is served at `http://localhost:5000/docs` (Swagger UI) and its OpenAPI document is available at `/docs/openapi.json`. The database diagram is checked in at [backend/prisma/ERD.md](backend/prisma/ERD.md); regenerate it from the Prisma schema with `cd backend && npm run db:erd`.

## Configuration and deployment

`.env.example` contains local development values. Replace the JWT secrets before exposing the API, keep `.env` private, and provide production PostgreSQL, Redis, S3, and email credentials through the hosting platform’s secret manager. The Compose files are for local development; production should use private managed services, TLS, backups, and restricted object-storage policies.

For the Vercel frontend plus container-hosted API and worker setup, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Automated checks

Backend unit tests: `cd backend && npm test`. API integration tests use a running PostgreSQL and Redis service: `cd backend && npm run test:integration`. The Playwright browser flow requires the full seeded stack and Chromium: `cd frontend && npx playwright install chromium && npm run test:e2e`. GitHub Actions runs all three suites along with TypeScript checks and production builds.
