import { Router } from "express";
import { EmploymentType, ExperienceLevel, JobStatus, Prisma, RoleName, WorkplaceType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../config/database";
import { authenticate, requireRoles } from "../../middleware/auth-guard";
import { asyncHandler, HttpError, requireAuth } from "../../shared/http";
import { canTransitionJob } from "./job-state";

const router = Router();
const jobFields = {
  title: z.string().trim().min(3).max(255),
  description: z.string().trim().min(20).max(30_000),
  requirements: z.string().trim().min(10).max(15_000),
  locationCity: z.string().trim().max(100).nullable().optional(),
  locationCountry: z.string().trim().max(100).nullable().optional(),
  workplaceType: z.nativeEnum(WorkplaceType),
  employmentType: z.nativeEnum(EmploymentType),
  experienceLevel: z.nativeEnum(ExperienceLevel),
  minSalary: z.number().nonnegative().nullable().optional(),
  maxSalary: z.number().nonnegative().nullable().optional(),
  currency: z.string().length(3).default("USD"),
  expiresAt: z.string().datetime().nullable().optional(),
  skills: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
};
const createJobSchema = z.object({ companyId: z.string().uuid(), ...jobFields }).refine(
  (data) => data.minSalary == null || data.maxSalary == null || data.minSalary <= data.maxSalary,
  { message: "Minimum salary cannot exceed maximum salary" },
);
const updateJobSchema = z.object({
  title: jobFields.title.optional(),
  description: jobFields.description.optional(),
  requirements: jobFields.requirements.optional(),
  locationCity: jobFields.locationCity,
  locationCountry: jobFields.locationCountry,
  workplaceType: jobFields.workplaceType.optional(),
  employmentType: jobFields.employmentType.optional(),
  experienceLevel: jobFields.experienceLevel.optional(),
  minSalary: jobFields.minSalary,
  maxSalary: jobFields.maxSalary,
  currency: z.string().length(3).optional(),
  expiresAt: jobFields.expiresAt,
  skills: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
  status: z.nativeEnum(JobStatus).optional(),
}).refine(
  (data) => data.minSalary == null || data.maxSalary == null || data.minSalary <= data.maxSalary,
  { message: "Minimum salary cannot exceed maximum salary" },
);
const jobInclude = { company: true, skills: { include: { skill: true } } } satisfies Prisma.JobInclude;

function slugify(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 180);
}

function decodeCursor(value: string | undefined): { createdAt: Date; id: string; relevance?: number } | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { createdAt?: unknown; id?: unknown; relevance?: unknown };
    if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") return undefined;
    if (!z.string().uuid().safeParse(parsed.id).success) return undefined;
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) return undefined;
    if (parsed.relevance !== undefined && (typeof parsed.relevance !== "number" || !Number.isFinite(parsed.relevance))) return undefined;
    return { createdAt, id: parsed.id, ...(typeof parsed.relevance === "number" ? { relevance: parsed.relevance } : {}) };
  } catch {
    return undefined;
  }
}

router.get("/saved/me", authenticate, requireRoles(RoleName.CANDIDATE), asyncHandler(async (request, response) => {
  const auth = requireAuth(request);
  const saved = await prisma.savedJob.findMany({
    where: { userId: auth.userId },
    include: { job: { include: jobInclude } },
    orderBy: { createdAt: "desc" },
  });
  response.json({ data: saved.map(({ createdAt, job }) => ({ savedAt: createdAt, ...job })) });
}));

router.get("/mine", authenticate, requireRoles(RoleName.RECRUITER, RoleName.COMPANY_ADMIN, RoleName.ADMIN), asyncHandler(async (request, response) => {
  const auth = requireAuth(request);
  const jobs = await prisma.job.findMany({
    where: auth.roles.includes(RoleName.ADMIN) ? {} : { company: { members: { some: { userId: auth.userId } } } },
    include: { ...jobInclude, _count: { select: { applications: true } } },
    orderBy: { updatedAt: "desc" },
  });
  response.json({ data: jobs });
}));

router.get("/", asyncHandler(async (request, response) => {
  const querySchema = z.object({
    q: z.string().trim().max(150).optional(),
    city: z.string().trim().max(100).optional(),
    country: z.string().trim().max(100).optional(),
    workplaceType: z.nativeEnum(WorkplaceType).optional(),
    employmentType: z.nativeEnum(EmploymentType).optional(),
    experienceLevel: z.nativeEnum(ExperienceLevel).optional(),
    minSalary: z.coerce.number().nonnegative().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  });
  const parsed = querySchema.safeParse(request.query);
  if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "Job search filters are invalid");
  const { q, city, country, workplaceType, employmentType, experienceLevel, minSalary, cursor, limit } = parsed.data;
  const point = decodeCursor(cursor);
  if (cursor && !point) throw new HttpError(400, "INVALID_CURSOR", "The job search cursor is invalid");
  if (q) {
    if (point && point.relevance === undefined) throw new HttpError(400, "INVALID_CURSOR", "This cursor does not match a ranked job search");
    const pattern = `%${q}%`;
    const query = Prisma.sql`plainto_tsquery('english', ${q})`;
    const hasSkills = Prisma.sql`EXISTS (
      SELECT 1 FROM job_skills js INNER JOIN skills s ON s.id = js.skill_id
      WHERE js.job_id = j.id AND s.name ILIKE ${pattern}
    )`;
    const relevance = Prisma.sql`(
      (GREATEST(
        CASE WHEN j.search_vector @@ ${query} THEN ts_rank_cd(j.search_vector, ${query}) ELSE 0 END,
        CASE WHEN c.name ILIKE ${pattern} THEN 0.2 ELSE 0 END,
        CASE WHEN ${hasSkills} THEN 0.1 ELSE 0 END
      ) + 0.05 / (1 + GREATEST(EXTRACT(EPOCH FROM (CURRENT_DATE::timestamp - j.created_at)) / 2592000.0, 0)))::double precision
    )`;
    const filters: Prisma.Sql[] = [
      Prisma.sql`j.status = 'ACTIVE'`,
      Prisma.sql`(j.search_vector @@ ${query} OR c.name ILIKE ${pattern} OR ${hasSkills})`,
    ];
    if (city) filters.push(Prisma.sql`j.location_city ILIKE ${`%${city}%`}`);
    if (country) filters.push(Prisma.sql`j.location_country ILIKE ${`%${country}%`}`);
    if (workplaceType) filters.push(Prisma.sql`j.workplace_type = ${workplaceType}::"WorkplaceType"`);
    if (employmentType) filters.push(Prisma.sql`j.employment_type = ${employmentType}::"EmploymentType"`);
    if (experienceLevel) filters.push(Prisma.sql`j.experience_level = ${experienceLevel}::"ExperienceLevel"`);
    if (minSalary !== undefined) filters.push(Prisma.sql`(j.max_salary IS NULL OR j.max_salary >= ${minSalary})`);
    if (point) {
      filters.push(Prisma.sql`(
        ${relevance} < ${point.relevance!}
        OR (${relevance} = ${point.relevance!} AND (j.created_at < ${point.createdAt} OR (j.created_at = ${point.createdAt} AND j.id < ${point.id}::uuid)))
      )`);
    }
    const ranked = await prisma.$queryRaw<Array<{ id: string; relevance: number; createdAt: Date }>>(Prisma.sql`
      SELECT j.id, ${relevance} AS relevance, j.created_at AS "createdAt"
      FROM jobs j INNER JOIN companies c ON c.id = j.company_id
      WHERE ${Prisma.join(filters, " AND ")}
      ORDER BY relevance DESC, j.created_at DESC, j.id DESC
      LIMIT ${limit + 1}
    `);
    const hasMore = ranked.length > limit;
    const pageRows = hasMore ? ranked.slice(0, limit) : ranked;
    const jobs = await prisma.job.findMany({
      where: { id: { in: pageRows.map(({ id }) => id) }, status: JobStatus.ACTIVE },
      include: jobInclude,
    });
    const jobsById = new Map(jobs.map((job) => [job.id, job]));
    const items = pageRows.flatMap(({ id }) => {
      const job = jobsById.get(id);
      return job ? [job] : [];
    });
    const last = pageRows.at(-1);
    const nextCursor = hasMore && last
      ? Buffer.from(JSON.stringify({ relevance: last.relevance, createdAt: last.createdAt.toISOString(), id: last.id })).toString("base64url")
      : null;
    response.json({ data: items, page: { nextCursor, hasMore, limit } });
    return;
  }
  const matchingJobs = q ? await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT j.id FROM jobs j INNER JOIN companies c ON c.id = j.company_id
    WHERE j.status = 'ACTIVE'
      AND (
        j.search_vector @@ plainto_tsquery('english', ${q})
        OR c.name ILIKE ${`%${q}%`}
        OR EXISTS (
          SELECT 1 FROM job_skills js INNER JOIN skills s ON s.id = js.skill_id
          WHERE js.job_id = j.id AND s.name ILIKE ${`%${q}%`}
        )
      )
  `) : undefined;
  if (matchingJobs && matchingJobs.length === 0) {
    response.json({ data: [], page: { nextCursor: null, hasMore: false, limit } });
    return;
  }
  const conditions: Prisma.JobWhereInput[] = [];
  if (minSalary !== undefined) conditions.push({ OR: [{ maxSalary: null }, { maxSalary: { gte: minSalary } }] });
  if (q) conditions.push({ OR: [
    { title: { contains: q, mode: "insensitive" } },
    { description: { contains: q, mode: "insensitive" } },
    { requirements: { contains: q, mode: "insensitive" } },
    { company: { name: { contains: q, mode: "insensitive" } } },
    { skills: { some: { skill: { name: { contains: q, mode: "insensitive" } } } } },
  ] });
  if (point) conditions.push({ OR: [
    { createdAt: { lt: point.createdAt } },
    { createdAt: point.createdAt, id: { lt: point.id } },
  ] });
  if (matchingJobs) conditions.push({ id: { in: matchingJobs.map(({ id }) => id) } });
  const where: Prisma.JobWhereInput = {
    status: JobStatus.ACTIVE,
    company: { deletedAt: null },
    ...(city ? { locationCity: { contains: city, mode: "insensitive" } } : {}),
    ...(country ? { locationCountry: { contains: country, mode: "insensitive" } } : {}),
    ...(workplaceType ? { workplaceType } : {}),
    ...(employmentType ? { employmentType } : {}),
    ...(experienceLevel ? { experienceLevel } : {}),
    ...(conditions.length ? { AND: conditions } : {}),
  };
  const jobs = await prisma.job.findMany({ where, include: jobInclude, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit + 1 });
  const hasMore = jobs.length > limit;
  const items = hasMore ? jobs.slice(0, limit) : jobs;
  const last = items.at(-1);
  const nextCursor = hasMore && last
    ? Buffer.from(JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last.id })).toString("base64url")
    : null;
  response.json({ data: items, page: { nextCursor, hasMore, limit } });
}));

router.get("/:id", asyncHandler(async (request, response) => {
  const id = z.string().uuid().safeParse(request.params.id);
  if (!id.success) throw new HttpError(400, "VALIDATION_ERROR", "Job id is invalid");
  const job = await prisma.job.findFirst({ where: { id: id.data, status: JobStatus.ACTIVE, company: { deletedAt: null } }, include: jobInclude });
  if (!job) throw new HttpError(404, "JOB_NOT_FOUND", "The requested job posting does not exist or is no longer active");
  await prisma.job.update({ where: { id: job.id }, data: { viewsCount: { increment: 1 } } });
  response.json({ data: job });
}));

router.post("/", authenticate, requireRoles(RoleName.RECRUITER, RoleName.COMPANY_ADMIN, RoleName.ADMIN), asyncHandler(async (request, response) => {
  const parsed = createJobSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Job data is invalid");
  const auth = requireAuth(request);
  const { skills, companyId, expiresAt, ...fields } = parsed.data;
  if (!auth.roles.includes(RoleName.ADMIN)) {
    const membership = await prisma.companyMember.findUnique({ where: { companyId_userId: { companyId, userId: auth.userId } } });
    if (!membership) throw new HttpError(403, "FORBIDDEN", "You are not a member of this company");
  }
  const baseSlug = slugify(fields.title);
  const job = await prisma.$transaction(async (transaction) => {
    const created = await transaction.job.create({
      data: {
        ...fields,
        companyId,
        postedByUserId: auth.userId,
        slug: `${baseSlug}-${Date.now().toString(36)}`,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        skills: { create: await Promise.all(skills.map(async (name) => {
          const skill = await transaction.skill.upsert({ where: { name }, create: { name }, update: {} });
          return { skillId: skill.id };
        })) },
      },
      include: jobInclude,
    });
    await transaction.auditLog.create({
      data: { actorId: auth.userId, action: "JOB_CREATED", entityName: "jobs", entityId: created.id },
    });
    return created;
  });
  response.status(201).json({ data: job });
}));

router.patch("/:id", authenticate, requireRoles(RoleName.RECRUITER, RoleName.COMPANY_ADMIN, RoleName.ADMIN), asyncHandler(async (request, response) => {
  const id = z.string().uuid().safeParse(request.params.id);
  const parsed = updateJobSchema.safeParse(request.body);
  if (!id.success || !parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "Job update is invalid");
  const auth = requireAuth(request);
  const existing = await prisma.job.findUnique({ where: { id: id.data } });
  if (!existing) throw new HttpError(404, "JOB_NOT_FOUND", "Job was not found");
  if (!auth.roles.includes(RoleName.ADMIN)) {
    const membership = await prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId: existing.companyId, userId: auth.userId } },
    });
    if (!membership) throw new HttpError(403, "FORBIDDEN", "You are not a member of this company");
  }
  const { skills, expiresAt, ...fields } = parsed.data;
  if (fields.status && !canTransitionJob(existing.status, fields.status, auth.roles.includes(RoleName.ADMIN))) {
    throw new HttpError(400, "INVALID_JOB_STATUS_TRANSITION", `Cannot move a job from ${existing.status} to ${fields.status}`);
  }
  const job = await prisma.$transaction(async (transaction) => {
    if (skills) {
      await transaction.jobSkill.deleteMany({ where: { jobId: id.data } });
    }
    const updated = await transaction.job.update({
      where: { id: id.data, updatedAt: existing.updatedAt },
      data: {
        ...fields,
        ...(expiresAt !== undefined ? { expiresAt: expiresAt ? new Date(expiresAt) : null } : {}),
        ...(skills ? { skills: { create: await Promise.all(skills.map(async (name) => {
          const skill = await transaction.skill.upsert({ where: { name }, create: { name }, update: {} });
          return { skillId: skill.id };
        })) } } : {}),
      },
      include: jobInclude,
    });
    if (fields.status && fields.status !== existing.status) {
      await transaction.auditLog.create({
        data: { actorId: auth.userId, action: "JOB_STATUS_CHANGED", entityName: "jobs", entityId: existing.id, metadata: { from: existing.status, to: fields.status } },
      });
    }
    return updated;
  }).catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new HttpError(409, "JOB_CHANGED", "This job changed while you were editing it; reload and try again");
    }
    throw error;
  });
  response.json({ data: job });
}));

router.post("/:id/save", authenticate, requireRoles(RoleName.CANDIDATE), asyncHandler(async (request, response) => {
  const auth = requireAuth(request);
  const id = z.string().uuid().safeParse(request.params.id);
  if (!id.success) throw new HttpError(400, "VALIDATION_ERROR", "Job id is invalid");
  const job = await prisma.job.findFirst({ where: { id: id.data, status: JobStatus.ACTIVE }, select: { id: true } });
  if (!job) throw new HttpError(404, "JOB_NOT_FOUND", "Job was not found");
  await prisma.savedJob.upsert({
    where: { userId_jobId: { userId: auth.userId, jobId: job.id } },
    create: { userId: auth.userId, jobId: job.id },
    update: {},
  });
  response.status(201).json({ data: { saved: true } });
}));

router.delete("/:id/save", authenticate, requireRoles(RoleName.CANDIDATE), asyncHandler(async (request, response) => {
  const auth = requireAuth(request);
  const id = z.string().uuid().safeParse(request.params.id);
  if (!id.success) throw new HttpError(400, "VALIDATION_ERROR", "Job id is invalid");
  await prisma.savedJob.deleteMany({ where: { userId: auth.userId, jobId: id.data } });
  response.status(204).end();
}));

export { router as jobRouter };
