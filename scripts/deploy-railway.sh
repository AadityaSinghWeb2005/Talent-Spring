#!/usr/bin/env bash
# Deploy TalentSpring to Railway (API + frontend + Postgres + Redis + bucket).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

RAILWAY=(npx --yes @railway/cli)

if ! "${RAILWAY[@]}" whoami >/dev/null 2>&1; then
  echo "Not logged in. Run: npx @railway/cli login"
  echo "Or open the browserless activate URL printed by: npx @railway/cli login --browserless"
  exit 1
fi

if ! "${RAILWAY[@]}" status >/dev/null 2>&1; then
  echo "Creating Railway project..."
  "${RAILWAY[@]}" init --name talent-spring --json
fi

echo "Ensuring Postgres..."
"${RAILWAY[@]}" add --database postgres --json 2>/dev/null || true

echo "Ensuring Redis..."
"${RAILWAY[@]}" add --database redis --json 2>/dev/null || true

echo "Ensuring uploads bucket..."
"${RAILWAY[@]}" bucket create uploads --region iad --json 2>/dev/null || true

echo "Ensuring api service..."
"${RAILWAY[@]}" add --service api --json 2>/dev/null || true

echo "Ensuring frontend service..."
"${RAILWAY[@]}" add --service frontend --json 2>/dev/null || true

JWT_ACCESS="${JWT_ACCESS_SECRET:-$(openssl rand -hex 32)}"
JWT_REFRESH="${JWT_REFRESH_SECRET:-$(openssl rand -hex 32)}"

echo "Setting API variables..."
"${RAILWAY[@]}" variable set \
  --service api \
  --skip-deploys \
  NODE_ENV=production \
  "DATABASE_URL=\${{Postgres.DATABASE_URL}}" \
  "REDIS_URL=\${{Redis.REDIS_URL}}" \
  "JWT_ACCESS_SECRET=${JWT_ACCESS}" \
  "JWT_REFRESH_SECRET=${JWT_REFRESH}" \
  "S3_BUCKET_NAME=\${{uploads.BUCKET}}" \
  "AWS_REGION=\${{uploads.REGION}}" \
  "AWS_ACCESS_KEY_ID=\${{uploads.ACCESS_KEY_ID}}" \
  "AWS_SECRET_ACCESS_KEY=\${{uploads.SECRET_ACCESS_KEY}}" \
  "S3_ENDPOINT=\${{uploads.ENDPOINT}}" \
  "S3_PUBLIC_ENDPOINT=\${{uploads.ENDPOINT}}" \
  "EMAIL_FROM=${EMAIL_FROM:-noreply@jobportal.com}" \
  "SENDGRID_API_KEY=${SENDGRID_API_KEY:-}" \
  "FRONTEND_URL=https://\${{frontend.RAILWAY_PUBLIC_DOMAIN}}"

echo "Generating public domains..."
"${RAILWAY[@]}" domain --service api --json || true
"${RAILWAY[@]}" domain --service frontend --json || true

echo "Setting frontend variables..."
"${RAILWAY[@]}" variable set \
  --service frontend \
  --skip-deploys \
  NODE_ENV=production \
  "NEXT_PUBLIC_API_URL=https://\${{api.RAILWAY_PUBLIC_DOMAIN}}/api/v1" \
  "API_INTERNAL_URL=https://\${{api.RAILWAY_PUBLIC_DOMAIN}}/api/v1"

echo "Deploying API from local backend/..."
"${RAILWAY[@]}" up ./backend --path-as-root --service api --detach --ci -y

echo "Deploying frontend from local frontend/..."
"${RAILWAY[@]}" up ./frontend --path-as-root --service frontend --detach --ci -y

echo ""
echo "Deployments started. Monitor with:"
echo "  npx @railway/cli logs --service api"
echo "  npx @railway/cli logs --service frontend"
echo "  npx @railway/cli domain list --service api --json"
echo "  npx @railway/cli domain list --service frontend --json"
echo ""
echo "After API is healthy, seed with:"
echo "  cd backend && npx @railway/cli run --service api -- npm run db:seed"
