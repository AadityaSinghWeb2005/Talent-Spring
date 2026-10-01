#!/bin/bash
set -euo pipefail

# TalentSpring Job Portal - Backend Deployment Script
# This script sets up all required services and deploys the backend to Render.

echo "=== TalentSpring Job Portal - Backend Deployment ==="
echo ""

# Check for required tools
command -v curl >/dev/null 2>&1 || { echo "curl is required but not installed. Aborting." >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "jq is required but not installed. Aborting." >&2; exit 1; }

# Check for Render API key
if [ -z "${RENDER_API_KEY:-}" ]; then
  echo "ERROR: RENDER_API_KEY environment variable is not set."
  echo ""
  echo "To get your Render API key:"
  echo "1. Go to https://render.com/dashboard"
  echo "2. Click on your profile picture -> Account Settings"
  echo "3. Scroll down to 'API Keys' and create a new key"
  echo "4. Run: export RENDER_API_KEY=your-key-here"
  echo ""
  exit 1
fi

# Check for required environment variables
REQUIRED_VARS=("DATABASE_URL" "REDIS_URL" "JWT_ACCESS_SECRET" "JWT_REFRESH_SECRET" "S3_BUCKET_NAME" "AWS_REGION" "AWS_ACCESS_KEY_ID" "AWS_SECRET_ACCESS_KEY" "S3_ENDPOINT" "S3_PUBLIC_ENDPOINT" "FRONTEND_URL")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    MISSING_VARS+=("$var")
  fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
  echo "ERROR: The following environment variables are not set:"
  for var in "${MISSING_VARS[@]}"; do
    echo "  - $var"
  done
  echo ""
  echo "Please set them before running this script."
  exit 1
fi

echo "All required environment variables are set."
echo ""

# Create Render services
echo "Creating Render services..."

# Create API service
echo "  Creating API service..."
curl -s -X POST "https://api.render.com/v1/services" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "job-portal-api",
    "type": "web_service",
    "repo": "https://github.com/hi-fb12/job-portal",
    "branch": "main",
    "rootDir": "backend",
    "buildCommand": "npm ci && npx prisma generate && npm run build",
    "startCommand": "npm run db:deploy && npm start",
    "healthCheckPath": "/health/readiness",
    "envVars": [
      {"key": "NODE_ENV", "value": "production"},
      {"key": "PORT", "value": "5000"},
      {"key": "DATABASE_URL", "value": "'"$DATABASE_URL"'"},
      {"key": "REDIS_URL", "value": "'"$REDIS_URL"'"},
      {"key": "JWT_ACCESS_SECRET", "value": "'"$JWT_ACCESS_SECRET"'"},
      {"key": "JWT_REFRESH_SECRET", "value": "'"$JWT_REFRESH_SECRET"'"},
      {"key": "S3_BUCKET_NAME", "value": "'"$S3_BUCKET_NAME"'"},
      {"key": "AWS_REGION", "value": "'"$AWS_REGION"'"},
      {"key": "AWS_ACCESS_KEY_ID", "value": "'"$AWS_ACCESS_KEY_ID"'"},
      {"key": "AWS_SECRET_ACCESS_KEY", "value": "'"$AWS_SECRET_ACCESS_KEY"'"},
      {"key": "S3_ENDPOINT", "value": "'"$S3_ENDPOINT"'"},
      {"key": "S3_PUBLIC_ENDPOINT", "value": "'"$S3_PUBLIC_ENDPOINT"'"},
      {"key": "SENDGRID_API_KEY", "value": "'"${SENDGRID_API_KEY:-}"'"},
      {"key": "EMAIL_FROM", "value": "'"${EMAIL_FROM:-noreply@jobportal.com}"'"},
      {"key": "FRONTEND_URL", "value": "'"$FRONTEND_URL"'"}
    ]
  }' | jq -r '.url // .message // "Error creating API service"'

# Create worker service
echo "  Creating worker service..."
curl -s -X POST "https://api.render.com/v1/services" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "job-portal-worker",
    "type": "worker",
    "repo": "https://github.com/hi-fb12/job-portal",
    "branch": "main",
    "rootDir": "backend",
    "buildCommand": "npm ci && npx prisma generate",
    "startCommand": "npm run worker",
    "envVars": [
      {"key": "NODE_ENV", "value": "production"},
      {"key": "REDIS_URL", "value": "'"$REDIS_URL"'"},
      {"key": "SENDGRID_API_KEY", "value": "'"${SENDGRID_API_KEY:-}"'"},
      {"key": "EMAIL_FROM", "value": "'"${EMAIL_FROM:-noreply@jobportal.com}"'"}
    ]
  }' | jq -r '.url // .message // "Error creating worker service"'

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Next steps:"
echo "1. Wait for Render to build and deploy both services (5-10 minutes)"
echo "2. Check the API health: curl https://job-portal-api.onrender.com/health/readiness"
echo "3. Seed the database: curl -X POST https://job-portal-api.onrender.com/api/v1/auth/seed"
echo "4. Update the frontend environment variables on Vercel to point to the deployed API"
echo ""
echo "To update frontend env vars on Vercel:"
echo "  cd frontend"
echo "  npx vercel env add NEXT_PUBLIC_API_URL production --value https://job-portal-api.onrender.com/api/v1 --yes"
echo "  npx vercel env add API_INTERNAL_URL production --value https://job-portal-api.onrender.com/api/v1 --yes"
echo "  npx vercel --prod"
