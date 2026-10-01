import {
  bucket,
  defineRailway,
  github,
  group,
  postgres,
  project,
  redis,
  ref,
  service,
} from "railway/iac";

const REPO = "AadityaSinghWeb2005/Talent-Spring";

export default defineRailway((ctx) => {
  const db = postgres("Postgres");
  const cache = redis("Redis");
  const uploads = bucket("uploads", { region: "iad" });

  const api = service("api", {
    source: github(REPO, { branch: "main", rootDirectory: "backend" }),
    start: "npm start",
    preDeploy: "npm run db:deploy",
    healthcheck: "/health/readiness",
    healthcheckTimeout: 120,
    env: {
      NODE_ENV: "production",
      DATABASE_URL: db.env.DATABASE_URL,
      REDIS_URL: cache.env.REDIS_URL,
      JWT_ACCESS_SECRET: ctx.randomString("jwt-access", 32),
      JWT_REFRESH_SECRET: ctx.randomString("jwt-refresh", 32),
      S3_BUCKET_NAME: ref(uploads, "BUCKET"),
      AWS_REGION: ref(uploads, "REGION"),
      AWS_ACCESS_KEY_ID: ref(uploads, "ACCESS_KEY_ID"),
      AWS_SECRET_ACCESS_KEY: ref(uploads, "SECRET_ACCESS_KEY"),
      S3_ENDPOINT: ref(uploads, "ENDPOINT"),
      S3_PUBLIC_ENDPOINT: ref(uploads, "ENDPOINT"),
      EMAIL_FROM: "noreply@jobportal.com",
      SENDGRID_API_KEY: "",
      // Set after `railway domain --service frontend` (or update to your Vercel URL).
      FRONTEND_URL: `https://\${{frontend.RAILWAY_PUBLIC_DOMAIN}}`,
    },
  });

  const frontend = service("frontend", {
    source: github(REPO, { branch: "main", rootDirectory: "frontend" }),
    start: "npm start",
    healthcheck: "/",
    healthcheckTimeout: 120,
    env: {
      NODE_ENV: "production",
      NEXT_PUBLIC_API_URL: `https://\${{api.RAILWAY_PUBLIC_DOMAIN}}/api/v1`,
      API_INTERNAL_URL: `http://\${{api.RAILWAY_PRIVATE_DOMAIN}}:5000/api/v1`,
    },
  });

  const data = group("Data", [db, cache, uploads]);
  const apps = group("Apps", [api, frontend]);

  return project(ctx.projectName ?? "talent-spring", {
    resources: [data, apps],
  });
});
