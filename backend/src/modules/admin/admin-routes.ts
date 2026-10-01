import { Router } from "express";
import { RoleName, UserStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../config/database";
import { authenticate, requireRoles } from "../../middleware/auth-guard";
import { asyncHandler, HttpError, requireAuth } from "../../shared/http";

const router = Router();
router.use(authenticate, requireRoles(RoleName.ADMIN));

router.get("/overview", asyncHandler(async (_request, response) => {
  const [users, candidates, recruiters, companies, activeJobs, applications, statusCounts] = await Promise.all([
    prisma.user.count(),
    prisma.userRole.count({ where: { role: { name: RoleName.CANDIDATE } } }),
    prisma.userRole.count({ where: { role: { name: RoleName.RECRUITER } } }),
    prisma.company.count(),
    prisma.job.count({ where: { status: "ACTIVE" } }),
    prisma.application.count(),
    prisma.application.groupBy({ by: ["currentStatus"], _count: { _all: true } }),
  ]);
  response.json({ data: { users, candidates, recruiters, companies, activeJobs, applications, applicationFunnel: Object.fromEntries(statusCounts.map((entry) => [entry.currentStatus, entry._count._all])) } });
}));

router.get("/users", asyncHandler(async (request, response) => {
  const parsed = z.object({ q: z.string().max(150).optional(), status: z.nativeEnum(UserStatus).optional(), limit: z.coerce.number().int().min(1).max(100).default(50) }).safeParse(request.query);
  if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "User filters are invalid");
  const users = await prisma.user.findMany({
    where: {
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.q ? { OR: [
        { email: { contains: parsed.data.q, mode: "insensitive" } },
        { firstName: { contains: parsed.data.q, mode: "insensitive" } },
        { lastName: { contains: parsed.data.q, mode: "insensitive" } },
      ] } : {}),
    },
    select: { id: true, email: true, firstName: true, lastName: true, status: true, isVerified: true, createdAt: true, roles: { include: { role: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: parsed.data.limit,
  });
  response.json({ data: users });
}));

router.patch("/users/:id/status", asyncHandler(async (request, response) => {
  const auth = requireAuth(request);
  const id = z.string().uuid().safeParse(request.params.id);
  const parsed = z.object({ status: z.nativeEnum(UserStatus) }).safeParse(request.body);
  if (!id.success || !parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "User status update is invalid");
  if (id.data === auth.userId && parsed.data.status !== UserStatus.ACTIVE) throw new HttpError(400, "INVALID_MODERATION", "You cannot suspend your own administrator account");
  const target = await prisma.user.findUnique({ where: { id: id.data } });
  if (!target) throw new HttpError(404, "USER_NOT_FOUND", "User was not found");
  const updated = await prisma.$transaction(async (transaction) => {
    const user = await transaction.user.update({ where: { id: id.data }, data: { status: parsed.data.status } });
    await transaction.auditLog.create({
      data: { actorId: auth.userId, action: "USER_STATUS_CHANGED", entityName: "users", entityId: id.data, metadata: { from: target.status, to: parsed.data.status } },
    });
    return user;
  });
  response.json({ data: { id: updated.id, email: updated.email, status: updated.status } });
}));

router.get("/companies", asyncHandler(async (_request, response) => {
  const companies = await prisma.company.findMany({
    include: { _count: { select: { jobs: true, members: true } } },
    orderBy: { createdAt: "desc" },
  });
  response.json({ data: companies });
}));

router.patch("/companies/:id/verification", asyncHandler(async (request, response) => {
  const auth = requireAuth(request);
  const id = z.string().uuid().safeParse(request.params.id);
  const parsed = z.object({ isVerified: z.boolean() }).safeParse(request.body);
  if (!id.success || !parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "Company moderation data is invalid");
  const updated = await prisma.$transaction(async (transaction) => {
    const company = await transaction.company.update({ where: { id: id.data }, data: { isVerified: parsed.data.isVerified } });
    await transaction.auditLog.create({ data: { actorId: auth.userId, action: "COMPANY_VERIFICATION_CHANGED", entityName: "companies", entityId: id.data, metadata: { isVerified: parsed.data.isVerified } } });
    return company;
  }).catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "P2025") throw new HttpError(404, "COMPANY_NOT_FOUND", "Company was not found");
    throw error;
  });
  response.json({ data: updated });
}));

router.get("/audit-logs", asyncHandler(async (request, response) => {
  const parsed = z.object({ cursor: z.string().uuid().optional(), limit: z.coerce.number().int().min(1).max(100).default(50) }).safeParse(request.query);
  if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "Audit log pagination is invalid");
  const rows = await prisma.auditLog.findMany({
    ...(parsed.data.cursor ? { cursor: { id: parsed.data.cursor }, skip: 1 } : {}),
    take: parsed.data.limit,
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { email: true, firstName: true, lastName: true } } },
  });
  const nextCursor = rows.length === parsed.data.limit ? rows.at(-1)?.id ?? null : null;
  response.json({ data: rows, page: { nextCursor } });
}));

export { router as adminRouter };
