import { Router } from "express";
import { RoleName } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../config/database";
import { authenticate, requireRoles } from "../../middleware/auth-guard";
import { asyncHandler, HttpError, requireAuth } from "../../shared/http";

const router = Router();
router.use(authenticate, requireRoles(RoleName.CANDIDATE, RoleName.RECRUITER, RoleName.COMPANY_ADMIN, RoleName.ADMIN));

router.get("/me", asyncHandler(async (request, response) => {
  const auth = requireAuth(request);
  const parsed = z.object({ unreadOnly: z.enum(["true", "false"]).optional() }).safeParse(request.query);
  if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "Notification filter is invalid");
  const notifications = await prisma.notification.findMany({
    where: { userId: auth.userId, ...(parsed.data.unreadOnly === "true" ? { readAt: null } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const unreadCount = await prisma.notification.count({ where: { userId: auth.userId, readAt: null } });
  response.json({ data: notifications, unreadCount });
}));

router.patch("/:id/read", asyncHandler(async (request, response) => {
  const auth = requireAuth(request);
  const id = z.string().uuid().safeParse(request.params.id);
  if (!id.success) throw new HttpError(400, "VALIDATION_ERROR", "Notification id is invalid");
  const update = await prisma.notification.updateMany({
    where: { id: id.data, userId: auth.userId },
    data: { readAt: new Date() },
  });
  if (update.count === 0) throw new HttpError(404, "NOTIFICATION_NOT_FOUND", "Notification was not found");
  response.status(204).end();
}));

router.patch("/read-all", asyncHandler(async (request, response) => {
  const auth = requireAuth(request);
  const result = await prisma.notification.updateMany({ where: { userId: auth.userId, readAt: null }, data: { readAt: new Date() } });
  response.json({ data: { updated: result.count } });
}));

export { router as notificationRouter };
