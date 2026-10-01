import { Router } from "express";
import { RoleName } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../config/database";
import { authenticate, requireRoles } from "../../middleware/auth-guard";
import { asyncHandler, HttpError, requireAuth } from "../../shared/http";

const router = Router();
const profileSchema = z.object({
  headline: z.string().trim().max(150).nullable().optional(),
  bio: z.string().max(5000).nullable().optional(),
  locationCity: z.string().trim().max(100).nullable().optional(),
  locationCountry: z.string().trim().max(100).nullable().optional(),
  currentSalary: z.number().nonnegative().nullable().optional(),
  expectedSalary: z.number().nonnegative().nullable().optional(),
  yearsOfExperience: z.number().int().min(0).max(80).optional(),
  isPublic: z.boolean().optional(),
  skills: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
});

router.use(authenticate, requireRoles(RoleName.CANDIDATE));
router.get("/me", asyncHandler(async (request, response) => {
  const auth = requireAuth(request);
  const profile = await prisma.profile.findUnique({
    where: { userId: auth.userId },
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true, phoneNumber: true } },
    },
  });
  if (!profile) throw new HttpError(404, "PROFILE_NOT_FOUND", "Candidate profile was not found");
  const [skills, resumes, educations, experiences, certifications, projects] = await Promise.all([
    prisma.candidateSkill.findMany({ where: { userId: auth.userId }, include: { skill: true } }),
    prisma.resume.findMany({ where: { userId: auth.userId }, orderBy: { createdAt: "desc" } }),
    prisma.education.findMany({ where: { userId: auth.userId }, orderBy: { startedAt: "desc" } }),
    prisma.experience.findMany({ where: { userId: auth.userId }, orderBy: { startedAt: "desc" } }),
    prisma.certification.findMany({ where: { userId: auth.userId }, orderBy: { issuedAt: "desc" } }),
    prisma.project.findMany({ where: { userId: auth.userId }, orderBy: { startedAt: "desc" } }),
  ]);
  response.json({ data: { ...profile, skills: skills.map(({ skill }) => skill), resumes, educations, experiences, certifications, projects } });
}));

router.patch("/me", asyncHandler(async (request, response) => {
  const auth = requireAuth(request);
  const parsed = profileSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "Profile data is invalid");
  const { skills, ...profileData } = parsed.data;
  const profile = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.profile.upsert({
      where: { userId: auth.userId },
      create: { userId: auth.userId, ...profileData },
      update: profileData,
    });
    if (skills) {
      const normalized = [...new Set(skills.map((skill) => skill.trim()))];
      await transaction.candidateSkill.deleteMany({ where: { userId: auth.userId } });
      for (const name of normalized) {
        const skill = await transaction.skill.upsert({ where: { name }, create: { name }, update: {} });
        await transaction.candidateSkill.create({ data: { userId: auth.userId, skillId: skill.id } });
      }
    }
    return updated;
  });
  response.json({ data: profile });
}));

const dateField = z.string().date().optional().nullable();
const educationSchema = z.object({ institution: z.string().trim().min(1).max(255), degree: z.string().max(150).optional(), fieldOfStudy: z.string().max(150).optional(), startedAt: dateField, endedAt: dateField, description: z.string().max(5000).optional() });
router.post("/me/educations", asyncHandler(async (request, response) => {
  const auth = requireAuth(request);
  const parsed = educationSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "Education data is invalid");
  const { startedAt, endedAt, ...fields } = parsed.data;
  const education = await prisma.education.create({ data: { userId: auth.userId, ...fields, startedAt: startedAt ? new Date(startedAt) : null, endedAt: endedAt ? new Date(endedAt) : null } });
  response.status(201).json({ data: education });
}));
router.delete("/me/educations/:id", asyncHandler(async (request, response) => {
  const auth = requireAuth(request);
  const id = z.string().uuid().safeParse(request.params.id);
  if (!id.success) throw new HttpError(400, "VALIDATION_ERROR", "Education id is invalid");
  const result = await prisma.education.deleteMany({ where: { id: id.data, userId: auth.userId } });
  if (!result.count) throw new HttpError(404, "EDUCATION_NOT_FOUND", "Education record was not found");
  response.status(204).end();
}));

const experienceSchema = z.object({ companyName: z.string().trim().min(1).max(255), title: z.string().trim().min(1).max(255), location: z.string().max(255).optional(), startedAt: z.string().date(), endedAt: dateField, description: z.string().max(5000).optional() });
router.post("/me/experiences", asyncHandler(async (request, response) => {
  const auth = requireAuth(request);
  const parsed = experienceSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "Experience data is invalid");
  const { startedAt, endedAt, ...fields } = parsed.data;
  const experience = await prisma.experience.create({ data: { userId: auth.userId, ...fields, startedAt: new Date(startedAt), endedAt: endedAt ? new Date(endedAt) : null } });
  response.status(201).json({ data: experience });
}));
router.delete("/me/experiences/:id", asyncHandler(async (request, response) => {
  const auth = requireAuth(request);
  const id = z.string().uuid().safeParse(request.params.id);
  if (!id.success) throw new HttpError(400, "VALIDATION_ERROR", "Experience id is invalid");
  const result = await prisma.experience.deleteMany({ where: { id: id.data, userId: auth.userId } });
  if (!result.count) throw new HttpError(404, "EXPERIENCE_NOT_FOUND", "Experience record was not found");
  response.status(204).end();
}));

const certificationSchema = z.object({ name: z.string().trim().min(1).max(255), issuer: z.string().max(255).optional(), credentialUrl: z.string().url().optional().or(z.literal("")), issuedAt: dateField, expiresAt: dateField });
router.post("/me/certifications", asyncHandler(async (request, response) => {
  const auth = requireAuth(request);
  const parsed = certificationSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "Certification data is invalid");
  const { issuedAt, expiresAt, ...fields } = parsed.data;
  const certification = await prisma.certification.create({ data: { userId: auth.userId, ...fields, credentialUrl: fields.credentialUrl || null, issuedAt: issuedAt ? new Date(issuedAt) : null, expiresAt: expiresAt ? new Date(expiresAt) : null } });
  response.status(201).json({ data: certification });
}));
router.delete("/me/certifications/:id", asyncHandler(async (request, response) => {
  const auth = requireAuth(request);
  const id = z.string().uuid().safeParse(request.params.id);
  if (!id.success) throw new HttpError(400, "VALIDATION_ERROR", "Certification id is invalid");
  const result = await prisma.certification.deleteMany({ where: { id: id.data, userId: auth.userId } });
  if (!result.count) throw new HttpError(404, "CERTIFICATION_NOT_FOUND", "Certification was not found");
  response.status(204).end();
}));

const projectSchema = z.object({ name: z.string().trim().min(1).max(255), description: z.string().max(5000).optional(), projectUrl: z.string().url().optional().or(z.literal("")), startedAt: dateField, endedAt: dateField });
router.post("/me/projects", asyncHandler(async (request, response) => {
  const auth = requireAuth(request);
  const parsed = projectSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "Project data is invalid");
  const { startedAt, endedAt, ...fields } = parsed.data;
  const project = await prisma.project.create({ data: { userId: auth.userId, ...fields, projectUrl: fields.projectUrl || null, startedAt: startedAt ? new Date(startedAt) : null, endedAt: endedAt ? new Date(endedAt) : null } });
  response.status(201).json({ data: project });
}));
router.delete("/me/projects/:id", asyncHandler(async (request, response) => {
  const auth = requireAuth(request);
  const id = z.string().uuid().safeParse(request.params.id);
  if (!id.success) throw new HttpError(400, "VALIDATION_ERROR", "Project id is invalid");
  const result = await prisma.project.deleteMany({ where: { id: id.data, userId: auth.userId } });
  if (!result.count) throw new HttpError(404, "PROJECT_NOT_FOUND", "Project was not found");
  response.status(204).end();
}));

router.get("/:userId", asyncHandler(async (request, response) => {
  const userId = z.string().uuid().safeParse(request.params.userId);
  if (!userId.success) throw new HttpError(400, "VALIDATION_ERROR", "User id is invalid");
  const profile = await prisma.profile.findFirst({
    where: { userId: userId.data, isPublic: true },
    include: { user: { select: { firstName: true, lastName: true } } },
  });
  if (!profile) throw new HttpError(404, "PROFILE_NOT_FOUND", "Public profile was not found");
  const skills = await prisma.candidateSkill.findMany({ where: { userId: userId.data }, include: { skill: true } });
  response.json({ data: { ...profile, skills: skills.map(({ skill }) => skill) } });
}));

export { router as profileRouter };
