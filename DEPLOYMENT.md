# Production deployment

## Recommended layout

Deploy the Next.js frontend to Vercel. Run the Express API and BullMQ email worker as separate long-running containers, and provide managed PostgreSQL, Redis, and S3-compatible object storage. The API container applies Prisma migrations before starting when launched through this repository's Compose command; for another container host, run `npm run db:deploy` as a release step before rolling out the API.

Vercel can run Express as a Function, but this API currently uses a persistent `app.listen()` bootstrap and the project also requires a separate BullMQ worker. The supported deployment path is therefore a container host for both backend processes. Vercel hosts the Next.js frontend only.

## Vercel frontend

1. Import the repository into Vercel and set **Root Directory** to `frontend`.
2. Keep the Next.js framework preset and the default `npm run build` command.
3. Set `NEXT_PUBLIC_API_URL` for Production, Preview, and Development as appropriate. Production should be the public API URL ending in `/api/v1`, for example `https://api.example.com/api/v1`. Set `API_INTERNAL_URL` to a server-reachable API URL as well (on Vercel, this can be the same HTTPS URL); local Compose points it to `http://api_backend:5000/api/v1`.
4. Deploy a preview first and verify sign-in, job search, profile pages, and recruiter dashboards against a non-production API and database.

The frontend calls the API from the browser and uploads files directly to the S3-compatible endpoint. The API URL and presigned-upload endpoint must be reachable by browsers over HTTPS. Do not set a production public variable to `localhost`.

## API, worker, and managed services

Run the backend `Dockerfile` as the API service and as a separate worker service. Use the same built image, but start the worker with `npm run worker`. Configure:

- `NODE_ENV=production`, `PORT`, and the exact frontend origin in `FRONTEND_URL`.
- `DATABASE_URL` for PostgreSQL 16 and `REDIS_URL` for Redis 7.
- Independent random `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` values of at least 32 characters.
- `S3_BUCKET_NAME`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_ENDPOINT`, and browser-reachable `S3_PUBLIC_ENDPOINT`.
- `SENDGRID_API_KEY` and `EMAIL_FROM` if email delivery is enabled.

Use HTTPS app and API subdomains under the same site (for example `app.example.com` and `api.example.com`) so the API's `SameSite=Strict` refresh cookie can accompany credentialed browser requests. Set `FRONTEND_URL` to the precise deployed frontend origin and permit that origin for browser uploads in the object storage CORS policy. Store secrets in the hosting provider's secret manager; never commit `.env` files.

Run `npm run db:deploy` once per release before serving traffic. Seed demo users only in a disposable development or staging database; never run `db:seed` on production data. Configure health checks against `/health/liveness` and `/health/readiness`, and use persistent managed database, Redis, and object-storage services with backups and restricted credentials.

## Verification before launch

The automated CI workflow runs type checks, builds, unit tests, database-backed API integration tests, and a browser scenario that applies to a role and advances it through recruiter review. Before a production launch, repeat the smoke checks using the actual production-like domains and credentials, verify direct resume uploads/downloads, and confirm email delivery with a real provider key.
