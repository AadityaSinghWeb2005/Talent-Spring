#!/bin/bash
set -euo pipefail

# TalentSpring Job Portal - Backend Services Setup
# This script guides you through setting up all required backend services.

echo "=== TalentSpring Job Portal - Backend Services Setup ==="
echo ""
echo "This guide will help you set up:"
echo "  1. PostgreSQL database (Neon)"
echo "  2. Redis (Upstash)"
echo "  3. Object storage (Cloudflare R2)"
echo "  4. Backend deployment (Render)"
echo ""
echo "Press Enter to continue..."
read -r

# Step 1: Neon PostgreSQL
echo ""
echo "=== Step 1: Set up PostgreSQL (Neon) ==="
echo ""
echo "1. Go to https://neon.tech and sign up/log in"
echo "2. Create a new project called 'job-portal'"
echo "3. Create a database named 'jobportal_db'"
echo "4. Copy the connection string (looks like: postgresql://user:pass@ep-xxx.region.aws.neon.tech/jobportal_db)"
echo ""
echo "Enter your Neon DATABASE_URL:"
read -r DATABASE_URL
export DATABASE_URL

# Step 2: Upstash Redis
echo ""
echo "=== Step 2: Set up Redis (Upstash) ==="
echo ""
echo "1. Go to https://upstash.com and sign up/log in"
echo "2. Create a new Redis database"
echo "3. Choose a region close to your Render deployment"
echo "4. Copy the connection string (looks like: rediss://default:pass@region.upstash.io:6379)"
echo ""
echo "Enter your Upstash REDIS_URL:"
read -r REDIS_URL
export REDIS_URL

# Step 3: Cloudflare R2
echo ""
echo "=== Step 3: Set up Object Storage (Cloudflare R2) ==="
echo ""
echo "1. Go to https://dash.cloudflare.com and sign up/log in"
echo "2. Go to R2 Object Storage"
echo "3. Create a bucket named 'jobportal-uploads'"
echo "4. Create an R2 API token with read/write access"
echo "5. Note the endpoint URL (looks like: https://accountid.r2.cloudflarestorage.com)"
echo ""
echo "Enter your R2 S3_BUCKET_NAME (default: jobportal-uploads):"
read -r S3_BUCKET_NAME
export S3_BUCKET_NAME=${S3_BUCKET_NAME:-jobportal-uploads}

echo "Enter your R2 AWS_REGION (default: auto):"
read -r AWS_REGION
export AWS_REGION=${AWS_REGION:-auto}

echo "Enter your R2 AWS_ACCESS_KEY_ID:"
read -r AWS_ACCESS_KEY_ID
export AWS_ACCESS_KEY_ID

echo "Enter your R2 AWS_SECRET_ACCESS_KEY:"
read -r AWS_SECRET_ACCESS_KEY
export AWS_SECRET_ACCESS_KEY

echo "Enter your R2 S3_ENDPOINT:"
read -r S3_ENDPOINT
export S3_ENDPOINT

echo "Enter your R2 S3_PUBLIC_ENDPOINT:"
read -r S3_PUBLIC_ENDPOINT
export S3_PUBLIC_ENDPOINT

# Step 4: Generate JWT secrets
echo ""
echo "=== Step 4: Generate JWT Secrets ==="
echo ""
JWT_ACCESS_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
export JWT_ACCESS_SECRET
export JWT_REFRESH_SECRET
echo "Generated JWT_ACCESS_SECRET: $JWT_ACCESS_SECRET"
echo "Generated JWT_REFRESH_SECRET: $JWT_REFRESH_SECRET"

# Step 5: Frontend URL
echo ""
echo "=== Step 5: Frontend URL ==="
echo ""
echo "Enter your frontend URL (default: https://frontend-hazel-rho-93.vercel.app):"
read -r FRONTEND_URL
export FRONTEND_URL=${FRONTEND_URL:-https://frontend-hazel-rho-93.vercel.app}

# Step 6: SendGrid (optional)
echo ""
echo "=== Step 6: SendGrid (optional) ==="
echo ""
echo "Enter your SendGrid API key (press Enter to skip):"
read -r SENDGRID_API_KEY
export SENDGRID_API_KEY=${SENDGRID_API_KEY:-}

echo "Enter your email from address (default: noreply@jobportal.com):"
read -r EMAIL_FROM
export EMAIL_FROM=${EMAIL_FROM:-noreply@jobportal.com}

# Summary
echo ""
echo "=== Configuration Summary ==="
echo ""
echo "DATABASE_URL=$DATABASE_URL"
echo "REDIS_URL=$REDIS_URL"
echo "S3_BUCKET_NAME=$S3_BUCKET_NAME"
echo "AWS_REGION=$AWS_REGION"
echo "AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID"
echo "AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY"
echo "S3_ENDPOINT=$S3_ENDPOINT"
echo "S3_PUBLIC_ENDPOINT=$S3_PUBLIC_ENDPOINT"
echo "JWT_ACCESS_SECRET=$JWT_ACCESS_SECRET"
echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET"
echo "FRONTEND_URL=$FRONTEND_URL"
echo "SENDGRID_API_KEY=$SENDGRID_API_KEY"
echo "EMAIL_FROM=$EMAIL_FROM"
echo ""
echo "=== Next Steps ==="
echo ""
echo "1. Go to https://render.com and sign up/log in"
echo "2. Create a new Blueprint and connect your GitHub repo"
echo "3. Render will detect render.yaml and create both services"
echo "4. Set the environment variables listed above in the Render dashboard"
echo "5. Deploy both services"
echo ""
echo "Or, if you have a Render API key, run:"
echo "  export RENDER_API_KEY=your-key"
echo "  ./deploy.sh"
echo ""
