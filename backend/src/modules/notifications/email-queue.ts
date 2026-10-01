import { Queue } from "bullmq";
import { redis } from "../../config/redis";

export type NotificationEmail = { to: string; name: string; title: string; body: string };
const queue = new Queue<NotificationEmail>("notification-email", {
  connection: redis.duplicate({ maxRetriesPerRequest: null }),
  defaultJobOptions: { attempts: 5, backoff: { type: "exponential", delay: 2000 }, removeOnComplete: 500, removeOnFail: 2000 },
});

export async function enqueueNotificationEmail(email: NotificationEmail): Promise<void> {
  await queue.add("send-notification", email, { jobId: `${Date.now()}-${Math.random().toString(36).slice(2)}` });
}

export async function closeEmailQueue(): Promise<void> {
  await queue.close();
}
