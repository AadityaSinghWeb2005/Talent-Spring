import "dotenv/config";
import sgMail from "@sendgrid/mail";
import { Worker } from "bullmq";
import { redis } from "../config/redis";
import type { NotificationEmail } from "../modules/notifications/email-queue";

const apiKey = process.env.SENDGRID_API_KEY;
if (apiKey) sgMail.setApiKey(apiKey);

const worker = new Worker<NotificationEmail>("notification-email", async (job) => {
  if (!apiKey) {
    process.stdout.write(JSON.stringify({ level: "warn", event: "email_skipped", reason: "SENDGRID_API_KEY is not configured", jobId: job.id }) + "\n");
    return;
  }
  await sgMail.send({
    to: job.data.to,
    from: process.env.EMAIL_FROM ?? "noreply@jobportal.com",
    subject: job.data.title,
    text: `${job.data.name},\n\n${job.data.body}\n\nTalentSpring`,
    html: `<main style="font-family:Arial,sans-serif;color:#17211f"><p>${escapeHtml(job.data.name)},</p><p>${escapeHtml(job.data.body)}</p><p>TalentSpring</p></main>`,
  });
}, { connection: redis.duplicate({ maxRetriesPerRequest: null }), concurrency: 5 });

worker.on("completed", (job) => process.stdout.write(JSON.stringify({ level: "info", event: "email_sent", jobId: job.id }) + "\n"));
worker.on("failed", (job, error) => process.stderr.write(JSON.stringify({ level: "error", event: "email_failed", jobId: job?.id, message: error.message }) + "\n"));

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]!);
}

async function shutdown(): Promise<void> {
  await worker.close();
  await redis.quit();
  process.exit(0);
}

process.on("SIGINT", () => { void shutdown(); });
process.on("SIGTERM", () => { void shutdown(); });
