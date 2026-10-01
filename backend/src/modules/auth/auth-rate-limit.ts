import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { redis } from "../../config/redis";

const incrementWindow = `for i=1,#KEYS do local n=redis.call('INCR',KEYS[i]); if n==1 then redis.call('EXPIRE',KEYS[i],60) end; if n>5 then return n end end; return 0`;

export async function authRateLimit(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const keys = [`rate:auth:ip:${request.ip ?? "unknown"}`];
    const email = request.path === "/login" && typeof request.body?.email === "string"
      ? request.body.email.trim().toLowerCase()
      : undefined;
    if (email) {
      const emailHash = createHash("sha256").update(email).digest("hex");
      keys.push(`rate:auth:account:${emailHash}`);
    }
    const count = Number(await redis.eval(incrementWindow, keys.length, ...keys));
    if (count > 5) {
      response.status(429).json({ error: { code: "RATE_LIMITED", message: "Too many authentication requests" } });
      return;
    }
    next();
  } catch {
    response.status(503).json({ error: { code: "AUTH_UNAVAILABLE", message: "Authentication is temporarily unavailable" } });
  }
}
