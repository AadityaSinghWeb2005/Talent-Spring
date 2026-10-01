import { Router } from "express";
import { ApplicationStatus, JobStatus, Prisma, RoleName } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../config/database";
import { authenticate, requireRoles } from "../../middleware/auth-guard";
import { asyncHandler, HttpError, requireAuth } from "../../shared/http";
import { queueUserEmail } from "../notifications/notification-service";
import { canCandidateWithdraw, canTransitionApplication } from "./application-state";

const router = Router();
const createApplicationSchema = z.object({
  jobId: z.string().uuid(),
  resumeId: z.string().uuid(),
  coverLetter: z.string().max(10_000).optional(),
});
const statusSchema = z.object({ status: z.nativeEnum(ApplicationStatus), notes: z.string().max(2000).optional() });
async function verifyRecruiterAccess(userId: string, roles: RoleName[], jobId: string): Promise<void> {
  if (roles.includes(RoleName.ADMIN)) return;
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { companyId: true } });
  if (!job) throw new HttpError(404, "JOB_NOT_FOUND", "Job was not found");
  const membership = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId: job.companyId, userId } },
  });
  if (!membership) throw new HttpError(403, "FORBIDDEN", "You cannot access this company’s applicants");
}

router.post("/applications", authenticate, requireRoles(RoleName.CANDIDATE), asyncHandler(async (request, response) => {
  const parsed = createApplicationSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "Application data is invalid");
  const auth = requireAuth(request);
  const application = await prisma.$transaction(async (transaction) => {
    const lockedJob = await transaction.$queryRaw<Array<{ status: JobStatus; expires_at: Date | null }>>`
      SELECT status, expires_at FROM jobs WHERE id = ${parsed.data.jobId}::uuid FOR SHARE
    `;
    const job = lockedJob[0];
    if (!job || job.status !== JobStatus.ACTIVE || (job.expires_at && job.expires_at <= new Date())) {
      throw new HttpError(400, "JOB_CLOSED_FOR_APPLICATIONS", "This job is no longer accepting applications");
    }
    const resume = await transaction.resume.findFirst({ where: { id: parsed.data.resumeId, userId: auth.userId } });
    if (!resume) throw new HttpError(400, "RESUME_NOT_OWNED", "Select a resume from your profile");
    const created = await transaction.application.create({
      data: {
        jobId: parsed.data.jobId,
        candidateId: auth.userId,
        resumeId: parsed.data.resumeId,
        coverLetter: parsed.data.coverLetter,
        history: { create: { changedByUserId: auth.userId, fromStatus: null, toStatus: ApplicationStatus.APPLIED } },
      },
      include: { job: { include: { company: true } }, resume: true },
    });
    await transaction.auditLog.create({
      data: { actorId: auth.userId, action: "APPLICATION_SUBMITTED", entityName: "applications", entityId: created.id },
    });
    await transaction.notification.create({
      data: {
        userId: auth.userId,
        type: "APPLICATION_SUBMITTED",
        title: "Application sent",
        body: `Your application for ${created.job.title} was submitted.`,
      },
    });
    return created;
  }).catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new HttpError(409, "DUPLICATE_APPLICATION", "You have already applied to this job");
    }
    throw error;
  });
  queueUserEmail(auth.userId, "Application received", `Your application for ${application.job.title} was submitted.`);
  response.status(201).json({ data: application });
}));

router.get("/applications/me", authenticate, requireRoles(RoleName.CANDIDATE), asyncHandler(async (request, response) => {
  const auth = requireAuth(request);
  const applications = await prisma.application.findMany({
    where: { candidateId: auth.userId },
    include: { job: { include: { company: true } }, resume: true, history: { orderBy: { createdAt: "asc" } }, interviews: true },
    orderBy: { createdAt: "desc" },
  });
  response.json({ data: applications });
}));

router.get("/interviews/me", authenticate, asyncHandler(async (request, response) => {
  const auth = requireAuth(request);
  const roles = auth.roles;
  if (!roles.some((role) => [RoleName.CANDIDATE, RoleName.RECRUITER, RoleName.COMPANY_ADMIN, RoleName.ADMIN].includes(role))) {
    throw new HttpError(403, "FORBIDDEN", "Interview access is not available for this account");
  }
  const where = roles.includes(RoleName.ADMIN) ? {} : roles.includes(RoleName.CANDIDATE)
    ? { application: { candidateId: auth.userId } }
    : { application: { job: { company: { members: { some: { userId: auth.userId } } } } } };
  const interviews = await prisma.interview.findMany({
    where,
    include: { application: { include: { job: { include: { company: true } }, candidate: { select: { firstName: true, lastName: true } } } } },
    orderBy: { startTime: "asc" },
    take: 100,
  });
  response.json({ data: interviews });
}));

router.get("/jobs/:jobId/applications", authenticate, requireRoles(RoleName.RECRUITER, RoleName.COMPANY_ADMIN, RoleName.ADMIN), asyncHandler(async (request, response) => {
  const jobId = z.string().uuid().safeParse(request.params.jobId);
  if (!jobId.success) throw new HttpError(400, "VALIDATION_ERROR", "Job id is invalid");
  const auth = requireAuth(request);
  await verifyRecruiterAccess(auth.userId, auth.roles, jobId.data);
  const applications = await prisma.application.findMany({
    where: { jobId: jobId.data },
    include: {
      candidate: {
        select: {
          id: true, firstName: true, lastName: true, email: true,
          profile: true,
          candidateSkills: { include: { skill: true } },
          educations: true, experiences: true,
        },
      },
      resume: true,
      history: { orderBy: { createdAt: "asc" } },
      notes: { include: { author: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" } },
      interviews: { orderBy: { startTime: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
  response.json({ data: applications });
}));

router.patch("/applications/:id/status", authenticate, requireRoles(RoleName.RECRUITER, RoleName.COMPANY_ADMIN, RoleName.ADMIN), asyncHandler(async (request, response) => {
  const id = z.string().uuid().safeParse(request.params.id);
  const parsed = statusSchema.safeParse(request.body);
  if (!id.success || !parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "Application status update is invalid");
  const auth = requireAuth(request);
  const current = await prisma.application.findUnique({ where: { id: id.data }, include: { job: true } });
  if (!current) throw new HttpError(404, "APPLICATION_NOT_FOUND", "Application was not found");
  await verifyRecruiterAccess(auth.userId, auth.roles, current.jobId);
  if (!canTransitionApplication(current.currentStatus, parsed.data.status)) {
    throw new HttpError(400, "INVALID_STATUS_TRANSITION", `Cannot move an application from ${current.currentStatus} to ${parsed.data.status}`);
  }
  const updated = await prisma.$transaction(async (transaction) => {
    const change = await transaction.application.updateMany({
      where: { id: current.id, currentStatus: current.currentStatus },
      data: { currentStatus: parsed.data.status },
    });
    if (change.count !== 1) throw new HttpError(409, "APPLICATION_CHANGED", "Application changed; reload and try again");
    const result = await transaction.application.findUniqueOrThrow({ where: { id: current.id } });
    await transaction.applicationStatusHistory.create({
      data: { applicationId: result.id, changedByUserId: auth.userId, fromStatus: current.currentStatus, toStatus: parsed.data.status, notes: parsed.data.notes },
    });
    await transaction.notification.create({
      data: { userId: result.candidateId, type: "APPLICATION_STATUS", title: "Application update", body: `Your application status changed to ${parsed.data.status.replaceAll("_", " ").toLowerCase()}.` },
    });
    await transaction.auditLog.create({
      data: { actorId: auth.userId, action: "APPLICATION_STATUS_CHANGED", entityName: "applications", entityId: result.id, metadata: { from: current.currentStatus, to: parsed.data.status } },
    });
    return result;
  });
  queueUserEmail(updated.candidateId, "Application update", `Your application status changed to ${parsed.data.status.replaceAll("_", " ").toLowerCase()}.`);
  response.json({ data: updated });
}));

router.patch("/applications/:id/withdraw", authenticate, requireRoles(RoleName.CANDIDATE), asyncHandler(async (request, response) => {
  const id = z.string().uuid().safeParse(request.params.id);
  if (!id.success) throw new HttpError(400, "VALIDATION_ERROR", "Application id is invalid");
  const auth = requireAuth(request);
  const current = await prisma.application.findFirst({ where: { id: id.data, candidateId: auth.userId } });
  if (!current) throw new HttpError(404, "APPLICATION_NOT_FOUND", "Application was not found");
  if (!canCandidateWithdraw(current.currentStatus)) {
    throw new HttpError(400, "INVALID_STATUS_TRANSITION", "This application can no longer be withdrawn");
  }
  await prisma.$transaction(async (transaction) => {
    await transaction.application.update({ where: { id: current.id }, data: { currentStatus: ApplicationStatus.WITHDRAWN } });
    await transaction.applicationStatusHistory.create({
      data: { applicationId: current.id, changedByUserId: auth.userId, fromStatus: current.currentStatus, toStatus: ApplicationStatus.WITHDRAWN },
    });
    await transaction.auditLog.create({ data: { actorId: auth.userId, action: "APPLICATION_WITHDRAWN", entityName: "applications", entityId: current.id } });
  });
  response.json({ data: { status: ApplicationStatus.WITHDRAWN } });
}));

const noteSchema = z.object({ note: z.string().trim().min(1).max(5000) });
router.post("/applications/:id/notes", authenticate, requireRoles(RoleName.RECRUITER, RoleName.COMPANY_ADMIN, RoleName.ADMIN), asyncHandler(async (request, response) => {
  const id = z.string().uuid().safeParse(request.params.id);
  const parsed = noteSchema.safeParse(request.body);
  if (!id.success || !parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "Note data is invalid");
  const auth = requireAuth(request);
  const application = await prisma.application.findUnique({ where: { id: id.data } });
  if (!application) throw new HttpError(404, "APPLICATION_NOT_FOUND", "Application was not found");
  await verifyRecruiterAccess(auth.userId, auth.roles, application.jobId);
  const note = await prisma.recruiterNote.create({ data: { applicationId: id.data, authorId: auth.userId, note: parsed.data.note } });
  response.status(201).json({ data: note });
}));

const interviewSchema = z.object({
  title: z.string().trim().min(2).max(255),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  meetingLink: z.string().url().max(2000).optional(),
});
router.post("/applications/:id/interviews", authenticate, requireRoles(RoleName.RECRUITER, RoleName.COMPANY_ADMIN, RoleName.ADMIN), asyncHandler(async (request, response) => {
  const id = z.string().uuid().safeParse(request.params.id);
  const parsed = interviewSchema.safeParse(request.body);
  if (!id.success || !parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "Interview data is invalid");
  const auth = requireAuth(request);
  const startTime = new Date(parsed.data.startTime);
  const endTime = new Date(parsed.data.endTime);
  if (endTime <= startTime || startTime <= new Date()) throw new HttpError(400, "INVALID_INTERVIEW_TIME", "Interview must have a future start time and a later end time");
  const application = await prisma.application.findUnique({ where: { id: id.data } });
  if (!application) throw new HttpError(404, "APPLICATION_NOT_FOUND", "Application was not found");
  await verifyRecruiterAccess(auth.userId, auth.roles, application.jobId);
  const interview = await prisma.$transaction(async (transaction) => {
    const overlaps = await transaction.interview.findFirst({
      where: { applicationId: id.data, status: "SCHEDULED", startTime: { lt: endTime }, endTime: { gt: startTime } },
    });
    if (overlaps) throw new HttpError(409, "INTERVIEW_CONFLICT", "This time overlaps another scheduled interview for the application");
    if (application.currentStatus !== ApplicationStatus.SHORTLISTED && application.currentStatus !== ApplicationStatus.INTERVIEW_SCHEDULED) {
      throw new HttpError(400, "INVALID_STATUS_TRANSITION", "Only shortlisted applicants can be scheduled for an interview");
    }
    const created = await transaction.interview.create({
      data: { applicationId: id.data, scheduledByUserId: auth.userId, title: parsed.data.title, startTime, endTime, meetingLink: parsed.data.meetingLink },
    });
    if (application.currentStatus !== ApplicationStatus.INTERVIEW_SCHEDULED) {
      await transaction.application.update({ where: { id: id.data }, data: { currentStatus: ApplicationStatus.INTERVIEW_SCHEDULED } });
      await transaction.applicationStatusHistory.create({
        data: { applicationId: id.data, changedByUserId: auth.userId, fromStatus: application.currentStatus, toStatus: ApplicationStatus.INTERVIEW_SCHEDULED },
      });
    }
    await transaction.notification.create({
      data: { userId: application.candidateId, type: "INTERVIEW_SCHEDULED", title: "Interview scheduled", body: `An interview has been scheduled for ${startTime.toISOString()}.` },
    });
    return created;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      throw new HttpError(409, "INTERVIEW_CONFLICT", "The interview schedule changed; reload and try again");
    }
    throw error;
  });
  queueUserEmail(application.candidateId, "Interview scheduled", `An interview has been scheduled for ${startTime.toISOString()}.`);
  response.status(201).json({ data: interview });
}));

router.patch("/interviews/:id/cancel", authenticate, asyncHandler(async (request, response) => {
  const auth = requireAuth(request);
  const id = z.string().uuid().safeParse(request.params.id);
  if (!id.success) throw new HttpError(400, "VALIDATION_ERROR", "Interview id is invalid");
  const interview = await prisma.interview.findUnique({ where: { id: id.data }, include: { application: true } });
  if (!interview) throw new HttpError(404, "INTERVIEW_NOT_FOUND", "Interview was not found");
  const candidateOwns = interview.application.candidateId === auth.userId && auth.roles.includes(RoleName.CANDIDATE);
  if (!candidateOwns) await verifyRecruiterAccess(auth.userId, auth.roles, interview.application.jobId);
  if (interview.status !== "SCHEDULED") throw new HttpError(400, "INTERVIEW_NOT_SCHEDULED", "Only scheduled interviews can be cancelled");
  const cancelled = await prisma.interview.update({ where: { id: interview.id }, data: { status: "CANCELLED" } });
  response.json({ data: cancelled });
}));

export { router as applicationRouter };
