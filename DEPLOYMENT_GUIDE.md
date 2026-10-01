# Deployment Guide

This guide walks through deploying the TalentSpring Job Portal to production.

## Architecture

- **Frontend**: Next.js → Vercel
- **Backend API**: Express → Render (container)
- **Email Worker**: BullMQ → Render (worker)
- **Database**: PostgreSQL → Neon (serverless Postgres)
- **Cache/Queue**: Redis → Upstash (serverless Redis)
- **Object Storage**: S3-compatible → Cloudflare R2 or AWS S3

## Prerequisites

- [Vercel account](https://vercel.com)
- [Render account](https://render.com)
- [Neon account](https://neon.tech)
- [Upstash account](https://upstash.com)
- [Cloudflare R2](https://developers.cloudflare.com/r2/) or AWS S3 account
- [SendGrid account](https://sendgrid.com) (optional, for email)

## Step 1: Set up PostgreSQL (Neon)

1. Create a new project in Neon
2. Create a database named `jobportal_db`
3. Copy the connection string (looks like `postgresql://user:pass@ep-xxx.region.aws.neon.tech/jobportal_db`)
4. Save this as `DATABASE_URL`

## Step 2: Set up Redis (Upstash)

1. Create a new Redis database in Upstash
2. Choose a region close to your Render deployment
3. Copy the connection string (looks like `rediss://default:pass@region.upstash.io:6379`)
4. Save this as `REDIS_URL`

## Step 3: Set up Object Storage (Cloudflare R2)

1. Create a new R2 bucket named `jobportal-uploads`
2. Create an R2 API token with read/write access
3. Note the endpoint URL (looks like `https://accountid.r2.cloudflarestorage.com`)
4. Save these values:
   - `S3_BUCKET_NAME=jobportal-uploads`
   - `AWS_REGION=auto`
   - `AWS_ACCESS_KEY_ID=<r2-access-key>`
   - `AWS_SECRET_ACCESS_KEY=<r2-secret-key>`
   - `S3_ENDPOINT=https://accountid.r2.cloudflarestorage.com`
   - `S3_PUBLIC_ENDPOINT=https://pub-<hash>.r2.dev` (or your custom domain)

## Step 4: Deploy Backend to Render

1. Push your code to GitHub
2. In Render, create a new **Blueprint** and connect your repo
3. Render will detect `render.yaml` and create both services
4. Set the following environment variables in Render (marked `sync: false` in render.yaml):
   - `DATABASE_URL` — from Neon
   - `REDIS_URL` — from Upstash
   - `JWT_ACCESS_SECRET` — generate with `openssl rand -hex 32`
   - `JWT_REFRESH_SECRET` — generate with `openssl rand -hex 32`
   - `S3_BUCKET_NAME` — `jobportal-uploads`
   - `AWS_REGION` — `auto` (for R2)
   - `AWS_ACCESS_KEY_ID` — from R2
   - `AWS_SECRET_ACCESS_KEY` — from R2
   - `S3_ENDPOINT` — from R2
   - `S3_PUBLIC_ENDPOINT` — from R2
   - `SENDGRID_API_KEY` — from SendGrid (optional)
   - `EMAIL_FROM` — `noreply@yourdomain.com`
   - `FRONTEND_URL` — `https://your-frontend.vercel.app`
5. Deploy both services (API and worker)

## Step 5: Deploy Frontend to Vercel

1. Push your code to GitHub
2. In Vercel, import the repository
3. Set **Root Directory** to `frontend`
4. Set the following environment variables:
   - `NEXT_PUBLIC_API_URL` — `https://your-api.onrender.com/api/v1`
   - `API_INTERNAL_URL` — `https://your-api.onrender.com/api/v1`
5. Deploy

## Step 6: Seed the Database

After the backend is deployed and healthy:

```sh
# Using Render's shell or your local machine with the production DATABASE_URL
cd backend
DATABASE_URL="postgresql://..." npx prisma migrate deploy
DATABASE_URL="..." SEED_PASSWORD="YourSecurePassword123!" npm run db:seed
```

## Step 7: Verify

1. Visit your Vercel URL — the frontend should load
2. Visit `https://your-api.onrender.com/docs` — Swagger UI should load
3. Visit `https://your-api.onrender.com/health/readiness` — should return `{"status":"ready"}`
4. Try logging in with a seeded account

## Environment Variables Reference

| Variable | Service | Description |
|----------|---------|-------------|
| `DATABASE_URL` | Backend | PostgreSQL connection string |
| `REDIS_URL` | Backend + Worker | Redis connection string |
| `JWT_ACCESS_SECRET` | Backend | Min 32 chars, random |
| `JWT_REFRESH_SECRET` | Backend | Min 32 chars, random |
| `S3_BUCKET_NAME` | Backend | R2 bucket name |
| `AWS_REGION` | Backend | `auto` for R2 |
| `AWS_ACCESS_KEY_ID` | Backend | R2 access key |
| `AWS_SECRET_ACCESS_KEY` | Backend | R2 secret key |
| `S3_ENDPOINT` | Backend | R2 endpoint |
| `S3_PUBLIC_ENDPOINT` | Backend | Public R2 URL |
| `SENDGRID_API_KEY` | Backend + Worker | SendGrid API key |
| `EMAIL_FROM` | Backend + Worker | From address for emails |
| `FRONTEND_URL` | Backend | Frontend origin for CORS |
| `NEXT_PUBLIC_API_URL` | Frontend | Browser→API URL |
| `API_INTERNAL_URL` | Frontend | Server→API URL |
| `SEED_PASSWORD` | Seed script | Demo account password |

## Troubleshooting

### Backend won't start
- Check Render logs for errors
- Verify all environment variables are set
- Ensure `DATABASE_URL` and `REDIS_URL` are correct

### Frontend can't reach API
- Verify `NEXT_PUBLIC_API_URL` is set correctly
- Check CORS settings on the backend (`FRONTEND_URL`)
- Ensure the API is deployed and healthy

### Uploads fail
- Verify R2 credentials and bucket name
- Check `S3_ENDPOINT` and `S3_PUBLIC_ENDPOINT`
- Ensure CORS is configured on the R2 bucket

### Emails not sending
- Verify `SENDGRID_API_KEY` is set
- Check that the worker service is running
- Without a SendGrid key, emails are skipped (logged as `email_skipped`)
