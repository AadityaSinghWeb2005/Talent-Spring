import { prisma } from "../../config/database";
import { enqueueNotificationEmail } from "./email-queue";

export function queueUserEmail(userId: string, title: string, body: string): void {
  void prisma.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true } })
    .then((user) => user ? enqueueNotificationEmail({ to: user.email, name: user.firstName, title, body }) : undefined)
    .catch((error: unknown) => {
      process.stderr.write(JSON.stringify({ level: "error", event: "email_enqueue_failed", userId, message: error instanceof Error ? error.message : String(error) }) + "\n");
    });
}
