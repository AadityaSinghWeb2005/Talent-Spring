import { Router } from "express";
import { RoleName } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../config/database";
import { authenticate, requireRoles } from "../../middleware/auth-guard";
import { asyncHandler, HttpError, requireAuth } from "../../shared/http";

const router = Router();
const createCompanySchema = z.object({
  name: z.string().trim().min(2).max(255),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  description: z.string().max(10_000).optional(),
  industry: z.string().max(100).optional(),
  companySize: z.string().max(50).optional(),
});
const updateCompanySchema = createCompanySchema.partial();

router.get("/directory", asyncHandler(async (request, response) => {
  const parsed = z.object({ q: z.string().trim().max(100).optional() }).safeParse(request.query);
  if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "Company search is invalid");
  const companies = await prisma.company.findMany({
    where: {
      deletedAt: null,
      jobs: { some: { status: "ACTIVE" } },
      ...(parsed.data.q ? { OR: [
        { name: { contains: parsed.data.q, mode: "insensitive" } },
        { industry: { contains: parsed.data.q, mode: "insensitive" } },
      ] } : {}),
    },
    include: { _count: { select: { jobs: true } } },
    orderBy: { name: "asc" },
  });
  response.json({ data: companies });
}));

router.get("/directory/:slug", asyncHandler(async (request, response) => {
  const slug = Array.isArray(request.params.slug) ? request.params.slug[0] : request.params.slug;
  const company = await prisma.company.findUnique({
    where: { slug, deletedAt: null },
    include: { jobs: { where: { status: "ACTIVE" }, include: { skills: { include: { skill: true } } }, orderBy: { createdAt: "desc" } } },
  });
  if (!company) throw new HttpError(404, "COMPANY_NOT_FOUND", "Company was not found");
  response.json({ data: company });
}));

router.use(authenticate);
router.get("/me", asyncHandler(async (request, response) => {
  const auth = requireAuth(request);
  const companies = await prisma.company.findMany({
    where: { members: { some: { userId: auth.userId } } },
    include: { _count: { select: { jobs: true, members: true } } },
    orderBy: { name: "asc" },
  });
  response.json({ data: companies });
}));

router.post("/", requireRoles(RoleName.RECRUITER, RoleName.COMPANY_ADMIN), asyncHandler(async (request, response) => {
  const parsed = createCompanySchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "Company data is invalid");
  const auth = requireAuth(request);
  const slugBase = parsed.data.name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const company = await prisma.$transaction(async (transaction) => {
    const created = await transaction.company.create({
      data: { ...parsed.data, websiteUrl: parsed.data.websiteUrl || null, slug: `${slugBase}-${Date.now().toString(36)}` },
    });
    await transaction.companyMember.create({ data: { companyId: created.id, userId: auth.userId, roleInCompany: "ADMIN" } });
    const companyAdminRole = await transaction.role.findUnique({ where: { name: RoleName.COMPANY_ADMIN } });
    if (companyAdminRole) {
      await transaction.userRole.upsert({
        where: { userId_roleId: { userId: auth.userId, roleId: companyAdminRole.id } },
        create: { userId: auth.userId, roleId: companyAdminRole.id },
        update: {},
      });
    }
    await transaction.auditLog.create({
      data: { actorId: auth.userId, action: "COMPANY_CREATED", entityName: "companies", entityId: created.id },
    });
    return created;
  });
  response.status(201).json({ data: company });
}));

router.patch("/:companyId", asyncHandler(async (request, response) => {
  const auth = requireAuth(request);
  const companyId = z.string().uuid().safeParse(request.params.companyId);
  if (!companyId.success) throw new HttpError(400, "VALIDATION_ERROR", "Company id is invalid");
  const parsed = updateCompanySchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "Company data is invalid");
  const company = await prisma.company.findUnique({ where: { id: companyId.data } });
  if (!company || company.deletedAt) throw new HttpError(404, "COMPANY_NOT_FOUND", "Company was not found");
  if (!auth.roles.includes(RoleName.ADMIN)) {
    const membership = await prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId: company.id, userId: auth.userId } },
    });
    if (!membership || membership.roleInCompany !== "ADMIN") throw new HttpError(403, "FORBIDDEN", "Company administrator access is required");
  }
  const updated = await prisma.company.update({ where: { id: company.id }, data: parsed.data });
  response.json({ data: updated });
}));

router.delete("/:companyId", asyncHandler(async (request, response) => {
  const auth = requireAuth(request);
  const companyId = z.string().uuid().safeParse(request.params.companyId);
  if (!companyId.success) throw new HttpError(400, "VALIDATION_ERROR", "Company id is invalid");
  const company = await prisma.company.findUnique({ where: { id: companyId.data } });
  if (!company || company.deletedAt) throw new HttpError(404, "COMPANY_NOT_FOUND", "Company was not found");
  if (!auth.roles.includes(RoleName.ADMIN)) {
    const membership = await prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId: company.id, userId: auth.userId } },
    });
    if (!membership || membership.roleInCompany !== "ADMIN") throw new HttpError(403, "FORBIDDEN", "Company administrator access is required");
  }
  await prisma.$transaction(async (transaction) => {
    await transaction.company.update({ where: { id: company.id }, data: { deletedAt: new Date() } });
    await transaction.job.updateMany({ where: { companyId: company.id, status: { not: "ARCHIVED" } }, data: { status: "ARCHIVED" } });
    await transaction.auditLog.create({
      data: { actorId: auth.userId, action: "COMPANY_DELETED", entityName: "companies", entityId: company.id },
    });
  });
  response.status(204).end();
}));

export { router as companyRouter };
