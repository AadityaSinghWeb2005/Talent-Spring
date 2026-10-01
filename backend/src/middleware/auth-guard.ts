import type { NextFunction, Request, Response } from "express";
import { RoleName } from "@prisma/client";
import { prisma } from "../config/database";
import { AuthError, verifyAccessToken, type AuthContext } from "../modules/auth/auth-service";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export async function authenticate(request: Request, response: Response, next: NextFunction): Promise<void> {
  const authorization = request.header("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
  if (!token) {
    response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication is required" } });
    return;
  }
  try {
    request.auth = await verifyAccessToken(token);
    next();
  } catch (error) {
    if (error instanceof AuthError) {
      response.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
      return;
    }
    response.status(401).json({ error: { code: "INVALID_ACCESS_TOKEN", message: "Access token is invalid or expired" } });
  }
}

export function requireRoles(...allowedRoles: RoleName[]) {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (!request.auth) {
      response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication is required" } });
      return;
    }
    if (!allowedRoles.some((role) => request.auth?.roles.includes(role))) {
      response.status(403).json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } });
      return;
    }
    next();
  };
}

export async function verifyCompanyAccess(request: Request, response: Response, next: NextFunction): Promise<void> {
  const auth = request.auth;
  const companyParam = request.params.companyId;
  const companyId = Array.isArray(companyParam) ? companyParam[0] : companyParam;
  if (!auth) {
    response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication is required" } });
    return;
  }
  if (auth.roles.includes(RoleName.ADMIN)) {
    next();
    return;
  }
  if (!companyId || (!auth.roles.includes(RoleName.RECRUITER) && !auth.roles.includes(RoleName.COMPANY_ADMIN))) {
    response.status(403).json({ error: { code: "FORBIDDEN", message: "Company access denied" } });
    return;
  }
  try {
    const membership = await prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId: auth.userId } },
    });
    if (!membership) {
      response.status(403).json({ error: { code: "FORBIDDEN", message: "Company access denied" } });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}
