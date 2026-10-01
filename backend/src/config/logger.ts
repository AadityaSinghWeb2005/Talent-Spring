import pino from "pino";
import pinoHttp from "pino-http";
import { randomUUID } from "node:crypto";
import type { AuthContext } from "../modules/auth/auth-service";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
  redact: { paths: ["req.headers.authorization", "req.headers.cookie", "res.headers.set-cookie"], censor: "[REDACTED]" },
});

export const requestLogger = pinoHttp({
  logger,
  genReqId: () => randomUUID(),
  customProps: (request) => {
    const authenticated = request as typeof request & { auth?: AuthContext };
    return authenticated.auth ? { userId: authenticated.auth.userId } : {};
  },
});
