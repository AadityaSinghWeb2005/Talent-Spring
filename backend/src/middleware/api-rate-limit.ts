import type { NextFunction, Request, Response } from "express";
import { redis } from "../config/redis";

const incrementWindow = `local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n`;

export async function apiRateLimit(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const count = Number(await redis.eval(incrementWindow, 1, `rate:api:${request.ip ?? "unknown"}`));
    if (count > 100) {
      response.status(429).json({ error: { code: "RATE_LIMITED", message: "Too many requests" } });
      return;
    }
    next();
  } catch {
    response.status(503).json({ error: { code: "SERVICE_UNAVAILABLE", message: "Request processing is temporarily unavailable" } });
  }
}
