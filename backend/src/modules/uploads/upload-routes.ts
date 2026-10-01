import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import type { GetObjectCommandOutput, HeadObjectCommandOutput } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Router } from "express";
import { RoleName } from "@prisma/client";
import { z } from "zod";
import { s3, s3Presign, uploadBucket } from "../../config/storage";
import { prisma } from "../../config/database";
import { authenticate } from "../../middleware/auth-guard";
import { asyncHandler, HttpError, requireAuth } from "../../shared/http";

const router = Router();
const kinds = ["RESUME", "PROFILE_IMAGE", "COMPANY_LOGO"] as const;
const supported = {
  RESUME: {
    "application/pdf": [".pdf"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  },
  PROFILE_IMAGE: { "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"], "image/webp": [".webp"] },
  COMPANY_LOGO: { "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"], "image/webp": [".webp"] },
} as const;
const uploadInput = z.object({
  fileName: z.string().trim().min(1).max(255).refine((name) => !name.includes("/") && !name.includes("\\")),
  mimeType: z.string().max(150),
  fileSizeBytes: z.number().int().positive(),
  kind: z.enum(kinds),
  companyId: z.string().uuid().optional(),
});
const completedInput = uploadInput.extend({ objectKey: z.string().min(1).max(600), isPrimary: z.boolean().optional() });

function verifyFileDeclaration(fileName: string, mimeType: string, fileSizeBytes: number, kind: (typeof kinds)[number]): void {
  const extensions = supported[kind][mimeType as keyof typeof supported[typeof kind]] as readonly string[] | undefined;
  if (!extensions?.includes(extname(fileName).toLowerCase())) throw new HttpError(400, "UNSUPPORTED_FILE", "File extension and content type must match an allowed upload format");
  const maxBytes = kind === "RESUME" ? 5 * 1024 * 1024 : 2 * 1024 * 1024;
  if (fileSizeBytes > maxBytes) throw new HttpError(413, "FILE_TOO_LARGE", `Maximum file size is ${kind === "RESUME" ? "5MB" : "2MB"}`);
}

function verifyMagic(kind: (typeof kinds)[number], mimeType: string, bytes: Uint8Array): void {
  const startsWith = (...signature: number[]) => signature.every((value, index) => bytes[index] === value);
  const asciiAt = (text: string, offset: number) => [...text].every((char, index) => bytes[offset + index] === char.charCodeAt(0));
  const valid = mimeType === "application/pdf" ? asciiAt("%PDF-", 0)
    : mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ? startsWith(0x50, 0x4b, 0x03, 0x04)
    : mimeType === "image/png" ? startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
    : mimeType === "image/jpeg" ? startsWith(0xff, 0xd8, 0xff)
    : mimeType === "image/webp" ? asciiAt("RIFF", 0) && asciiAt("WEBP", 8)
    : false;
  if (!valid || bytes.length < (kind === "RESUME" ? 4 : 12)) throw new HttpError(400, "INVALID_FILE_CONTENT", "Uploaded file contents do not match the declared file type");
}

async function verifyCompany(userId: string, roles: RoleName[], companyId: string): Promise<void> {
  if (roles.includes(RoleName.ADMIN)) return;
  const membership = await prisma.companyMember.findUnique({ where: { companyId_userId: { companyId, userId } } });
  if (!membership) throw new HttpError(403, "FORBIDDEN", "You are not a member of this company");
}

router.use(authenticate);

router.post("/presigned-url", asyncHandler(async (request, response) => {
  const auth = requireAuth(request);
  const parsed = uploadInput.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "Upload metadata is invalid");
  const { kind, companyId, fileName, mimeType, fileSizeBytes } = parsed.data;
  verifyFileDeclaration(fileName, mimeType, fileSizeBytes, kind);
  try {
    await s3.send(new HeadBucketCommand({ Bucket: uploadBucket }));
  } catch {
    throw new HttpError(503, "STORAGE_UNAVAILABLE", "File storage is temporarily unavailable. Please retry shortly.");
  }
  if (kind === "RESUME" && !auth.roles.includes(RoleName.CANDIDATE)) throw new HttpError(403, "FORBIDDEN", "Only candidates can upload resumes");
  if (kind === "PROFILE_IMAGE" && !auth.roles.includes(RoleName.CANDIDATE)) throw new HttpError(403, "FORBIDDEN", "Only candidates can upload profile images");
  if (kind === "COMPANY_LOGO") {
    if (!companyId) throw new HttpError(400, "VALIDATION_ERROR", "A company id is required for company logos");
    await verifyCompany(auth.userId, auth.roles, companyId);
  }
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const directory = kind === "COMPANY_LOGO" ? `companies/${companyId}` : `${auth.userId}/${kind.toLowerCase()}`;
  const objectKey = `${directory}/${randomUUID()}-${safeName}`;
  const uploadUrl = await getSignedUrl(s3Presign, new PutObjectCommand({
    Bucket: uploadBucket,
    Key: objectKey,
    ContentType: mimeType,
    Metadata: { ownerid: auth.userId, uploadkind: kind },
  }), { expiresIn: 300 });
  response.status(201).json({ data: {
    uploadUrl,
    objectKey,
    expiresInSeconds: 300,
    headers: { "content-type": mimeType, "x-amz-meta-ownerid": auth.userId, "x-amz-meta-uploadkind": kind },
  } });
}));

router.post("/complete", asyncHandler(async (request, response) => {
  const auth = requireAuth(request);
  const parsed = completedInput.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "Upload completion data is invalid");
  const { objectKey, kind, companyId, fileName, mimeType, fileSizeBytes, isPrimary } = parsed.data;
  verifyFileDeclaration(fileName, mimeType, fileSizeBytes, kind);
  const expectedPrefix = kind === "COMPANY_LOGO" ? `companies/${companyId}/` : `${auth.userId}/${kind.toLowerCase()}/`;
  if (!objectKey.startsWith(expectedPrefix)) throw new HttpError(403, "FORBIDDEN", "Uploaded file does not belong to this account");
  if (kind === "COMPANY_LOGO") {
    if (!companyId) throw new HttpError(400, "VALIDATION_ERROR", "A company id is required for company logos");
    await verifyCompany(auth.userId, auth.roles, companyId);
  }
  let head: HeadObjectCommandOutput;
  let object: GetObjectCommandOutput;
  try {
    head = await s3.send(new HeadObjectCommand({ Bucket: uploadBucket, Key: objectKey }));
    object = await s3.send(new GetObjectCommand({ Bucket: uploadBucket, Key: objectKey, Range: "bytes=0-15" }));
  } catch {
    throw new HttpError(503, "STORAGE_UNAVAILABLE", "The uploaded file could not be checked because storage is temporarily unavailable. Please retry.");
  }
  if (head.Metadata?.ownerid !== auth.userId || head.Metadata.uploadkind !== kind || head.ContentLength !== fileSizeBytes || head.ContentType !== mimeType) {
    throw new HttpError(400, "UPLOAD_NOT_VERIFIED", "Uploaded file metadata could not be verified");
  }
  if (!object.Body) throw new HttpError(400, "UPLOAD_NOT_VERIFIED", "Uploaded file contents are missing");
  verifyMagic(kind, mimeType, await object.Body.transformToByteArray());

  if (kind === "RESUME") {
    const resume = await prisma.$transaction(async (transaction) => {
      const existingCount = await transaction.resume.count({ where: { userId: auth.userId } });
      if (isPrimary || existingCount === 0) await transaction.resume.updateMany({ where: { userId: auth.userId }, data: { isPrimary: false } });
      return transaction.resume.create({
        data: { userId: auth.userId, fileName, fileUrl: `s3://${uploadBucket}/${objectKey}`, fileSizeBytes, mimeType, isPrimary: isPrimary ?? existingCount === 0 },
      });
    });
    response.status(201).json({ data: resume });
    return;
  }
  if (kind === "PROFILE_IMAGE") {
    await prisma.profile.update({ where: { userId: auth.userId }, data: { avatarUrl: `s3://${uploadBucket}/${objectKey}` } });
    response.status(201).json({ data: { objectKey, avatarUrl: `s3://${uploadBucket}/${objectKey}` } });
    return;
  }
  await prisma.company.update({ where: { id: companyId! }, data: { logoUrl: `s3://${uploadBucket}/${objectKey}` } });
  response.status(201).json({ data: { objectKey, logoUrl: `s3://${uploadBucket}/${objectKey}` } });
}));

router.patch("/resumes/:resumeId/primary", asyncHandler(async (request, response) => {
  const auth = requireAuth(request);
  const resumeId = z.string().uuid().safeParse(request.params.resumeId);
  if (!resumeId.success || !auth.roles.includes(RoleName.CANDIDATE)) throw new HttpError(400, "VALIDATION_ERROR", "Resume id is invalid");
  const resume = await prisma.resume.findFirst({ where: { id: resumeId.data, userId: auth.userId } });
  if (!resume) throw new HttpError(404, "RESUME_NOT_FOUND", "Resume was not found");
  await prisma.$transaction([
    prisma.resume.updateMany({ where: { userId: auth.userId }, data: { isPrimary: false } }),
    prisma.resume.update({ where: { id: resume.id }, data: { isPrimary: true } }),
  ]);
  response.json({ data: { id: resume.id, isPrimary: true } });
}));

router.delete("/resumes/:resumeId", asyncHandler(async (request, response) => {
  const auth = requireAuth(request);
  const resumeId = z.string().uuid().safeParse(request.params.resumeId);
  if (!resumeId.success || !auth.roles.includes(RoleName.CANDIDATE)) throw new HttpError(400, "VALIDATION_ERROR", "Resume id is invalid");
  const resume = await prisma.resume.findFirst({ where: { id: resumeId.data, userId: auth.userId } });
  if (!resume) throw new HttpError(404, "RESUME_NOT_FOUND", "Resume was not found");
  if (await prisma.application.count({ where: { resumeId: resume.id } })) throw new HttpError(409, "RESUME_IN_USE", "A resume attached to an application cannot be deleted");
  await prisma.resume.delete({ where: { id: resume.id } });
  const prefix = `s3://${uploadBucket}/`;
  if (resume.fileUrl.startsWith(prefix)) {
    await s3.send(new DeleteObjectCommand({ Bucket: uploadBucket, Key: resume.fileUrl.slice(prefix.length) }));
  }
  if (resume.isPrimary) {
    const nextResume = await prisma.resume.findFirst({ where: { userId: auth.userId }, orderBy: { createdAt: "desc" } });
    if (nextResume) await prisma.resume.update({ where: { id: nextResume.id }, data: { isPrimary: true } });
  }
  response.status(204).end();
}));

router.get("/resumes/:resumeId/download-url", asyncHandler(async (request, response) => {
  const auth = requireAuth(request);
  const resumeId = z.string().uuid().safeParse(request.params.resumeId);
  if (!resumeId.success) throw new HttpError(400, "VALIDATION_ERROR", "Resume id is invalid");
  const resume = await prisma.resume.findUnique({ where: { id: resumeId.data } });
  if (!resume) throw new HttpError(404, "RESUME_NOT_FOUND", "Resume was not found");
  if (resume.userId !== auth.userId && !auth.roles.includes(RoleName.ADMIN)) {
    const application = await prisma.application.findFirst({ where: { resumeId: resume.id }, select: { job: { select: { companyId: true } } } });
    const membership = application ? await prisma.companyMember.findUnique({ where: { companyId_userId: { companyId: application.job.companyId, userId: auth.userId } } }) : null;
    if (!membership) throw new HttpError(403, "FORBIDDEN", "You cannot access this resume");
  }
  const key = resume.fileUrl.startsWith(`s3://${uploadBucket}/`) ? resume.fileUrl.slice(`s3://${uploadBucket}/`.length) : undefined;
  if (!key) throw new HttpError(404, "RESUME_NOT_FOUND", "Resume storage reference is invalid");
  const downloadUrl = await getSignedUrl(s3Presign, new GetObjectCommand({ Bucket: uploadBucket, Key: key, ResponseContentDisposition: `attachment; filename="${resume.fileName.replace(/["\\]/g, "_")}"` }), { expiresIn: 300 });
  response.json({ data: { downloadUrl, expiresInSeconds: 300 } });
}));

export { router as uploadRouter };
