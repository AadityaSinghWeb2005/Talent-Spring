import type { NextFunction, Request, RequestHandler, Response } from "express";

export class HttpError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

export function asyncHandler(handler: (request: Request, response: Response, next: NextFunction) => Promise<void>): RequestHandler {
  return (request, response, next) => {
    void handler(request, response, next).catch(next);
  };
}

export function requireAuth(request: Request) {
  if (!request.auth) throw new HttpError(401, "UNAUTHENTICATED", "Authentication is required");
  return request.auth;
}

export function sendError(error: unknown, response: Response): boolean {
  if (error instanceof HttpError) {
    response.status(error.status).json({ error: { code: error.code, message: error.message } });
    return true;
  }
  return false;
}
