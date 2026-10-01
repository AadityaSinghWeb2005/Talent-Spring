import express from "express";
import cors from "cors";
import helmet from "helmet";
import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { requestLogger, logger } from "./config/logger";
import { prisma } from "./config/database";
import { redis } from "./config/redis";
import { authErrorHandler, authRouter } from "./modules/auth/auth-routes";
import { apiRateLimit } from "./middleware/api-rate-limit";
import { companyRouter } from "./modules/companies/company-routes";
import { profileRouter } from "./modules/profiles/profile-routes";
import { jobRouter } from "./modules/jobs/job-routes";
import { applicationRouter } from "./modules/applications/application-routes";
import { notificationRouter } from "./modules/notifications/notification-routes";
import { adminRouter } from "./modules/admin/admin-routes";
import { uploadRouter } from "./modules/uploads/upload-routes";
import { HttpError } from "./shared/http";
import { openApiSpec } from "./openapi";
import { retryWithBackoff } from "./shared/retry";

export const app = express();

app.disable("x-powered-by");
app.use(requestLogger);
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:3000", credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.get("/docs/openapi.json", (_request, response) => response.json(openApiSpec));
app.get("/docs/swagger-init.js", (_request, response) => {
  response.type("application/javascript").send('window.onload = () => SwaggerUIBundle({ url: "/docs/openapi.json", dom_id: "#swagger-ui", deepLinking: true, presets: [SwaggerUIBundle.presets.apis], layout: "BaseLayout" });');
});
app.get("/docs", (_request, response) => {
  response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' https://unpkg.com; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data:; connect-src 'self'");
  response.type("html").send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Job Portal API</title><link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"></head><body><div id="swagger-ui"></div><script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script><script src="/docs/swagger-init.js"></script></body></html>`);
});
app.use("/api/v1", apiRateLimit);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/companies", companyRouter);
app.use("/api/v1/profiles", profileRouter);
app.use("/api/v1/jobs", jobRouter);
app.use("/api/v1", applicationRouter);
app.use("/api/v1/notifications", notificationRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/uploads", uploadRouter);

app.get("/health/liveness", (_request, response) => {
  response.status(200).json({ status: "ok" });
});

app.get("/health/readiness", async (_request, response) => {
  try {
    await retryWithBackoff(() => Promise.all([prisma.$queryRaw`SELECT 1`, redis.ping()]));
    response.status(200).json({ status: "ready" });
  } catch {
    response.status(503).json({ status: "not_ready" });
  }
});

app.use(authErrorHandler);

app.use((_request, response) => {
  response.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Route not found", details: [], timestamp: new Date().toISOString(), requestId: response.getHeader("x-request-id") } });
});

const errorHandler: ErrorRequestHandler = (error: unknown, request, response, _next) => {
  const requestId = request.id as string | undefined;
  let status = 500;
  let code = "INTERNAL_ERROR";
  let message = "An unexpected error occurred";
  if (error instanceof Error) logger.error({ err: error, requestId }, "Request failed");
  if (error instanceof HttpError) {
    status = error.status; code = error.code; message = error.message;
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") { status = 404; code = "RESOURCE_NOT_FOUND"; message = "The requested resource was not found"; }
    else if (error.code === "P2002") { status = 409; code = "RESOURCE_CONFLICT"; message = "A record with these details already exists"; }
    else if (error.code === "P2003") { status = 400; code = "INVALID_REFERENCE"; message = "A referenced record is invalid"; }
  } else if (error instanceof SyntaxError) {
    status = 400; code = "INVALID_JSON"; message = "Request body must contain valid JSON";
  }
  response.status(status).json({ success: false, error: { code, message, details: [], timestamp: new Date().toISOString(), requestId } });
};

app.use(errorHandler);
