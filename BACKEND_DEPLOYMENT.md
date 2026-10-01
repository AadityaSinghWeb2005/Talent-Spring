# Backend Deployment Guide

The frontend is deployed at: https://frontend-hazel-rho-93.vercel.app

The backend needs to be deployed separately since it requires persistent connections (Redis, Prisma). Here's how to set it up:

## Quick Start (Render Dashboard)

### 1. Push code to GitHub

```sh
cd "/home/Aadi/Documents/Job-Portal Application"
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/job-portal.git
git push -u origin main
```

### 2. Set up PostgreSQL (Neon)

1. Go to https://neon.tech and sign up/log in
2. Create a new project called 'job-portal'
3. Create a database named 'jobportal_db'
4. Copy the connection string

### 3. Set up Redis (Upstash)

1. Go to https://upstash.com and sign up/log in
2. Create a new Redis database
3. Copy the connection string

### 4. Set up Object Storage (Cloudflare R2)

1. Go to https://dash.cloudflare.com and sign up/log in
2. Go to R2 Object Storage
3. Create a bucket named 'jobportal-uploads'
4. Create an R2 API token with read/write access
5. Note the endpoint URL

### 5. Deploy to Render

1. Go to https://render.com and sign up/log in
2. Click "New" -> "Blueprint"
3. Connect your GitHub repo
4. Render will detect `render.yaml` and create both services
5. Set the environment variables (see below)
6. Click "Apply" to deploy

### 6. Environment Variables for Render

Set these in the Render dashboard for both services:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | From Neon |
| `REDIS_URL` | From Upstash |
| `JWT_ACCESS_SECRET` | Generate with `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | Generate with `openssl rand -hex 32` |
| `S3_BUCKET_NAME` | `jobportal-uploads` |
| `AWS_REGION` | `auto` |
| `AWS_ACCESS_KEY_ID` | From R2 |
| `AWS_SECRET_ACCESS_KEY` | From R2 |
| `S3_ENDPOINT` | From R2 |
| `S3_PUBLIC_ENDPOINT` | From R2 |
| `SENDGRID_API_KEY` | From SendGrid (optional) |
| `EMAIL_FROM` | `noreply@yourdomain.com` |
| `FRONTEND_URL` | `https://frontend-hazel-rho-93.vercel.app` |

### 7. Seed the Database

After deployment, run the seed script:

```sh
# Using Render's shell or your local machine
cd backend
DATABASE_URL="your-neon-url" SEED_PASSWORD="YourSecurePassword123!" npm run db:seed
```

### 8. Update Frontend Environment Variables

```sh
cd frontend
npx vercel env add NEXT_PUBLIC_API_URL production --value "https://job-portal-api.onrender.com/api/v1" --yes
npx vercel env add API_INTERNAL_URL production --value "https://job-portal-api.onrender.com/api/v1" --yes
npx vercel --prod
```

## Verification

1. Check API health: `curl https://job-portal-api.onrender.com/health/readiness`
2. Check Swagger UI: https://job-portal-api.onrender.com/docs
3. Try logging in on the frontend with a seeded account

## Alternative: Docker Compose (Local)

If you want to run everything locally:

```sh
cd "/home/Aadi/Documents/Job-Portal Application"
cp .env.example .env
# Edit .env with your JWT secrets
docker compose up --build -d
docker compose exec api_backend npm run db:seed
```

The app will be available at http://localhost:3000
