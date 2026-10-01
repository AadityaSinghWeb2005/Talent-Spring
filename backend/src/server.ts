import "dotenv/config";
import { CreateBucketCommand, HeadBucketCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { app } from "./app";
import { prisma } from "./config/database";
import { redis } from "./config/redis";
import { s3, uploadBucket } from "./config/storage";

const port = Number(process.env.PORT ?? 5000);

async function startEmailWorker(): Promise<void> {
  const { Worker } = await import("bullmq");
  const sgMail = (await import("@sendgrid/mail")).default;
  const apiKey = process.env.SENDGRID_API_KEY;
  if (apiKey) sgMail.setApiKey(apiKey);

  const worker = new Worker("notification-email", async (job) => {
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
    return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
  }

  process.stdout.write("Email worker started\n");
}

async function start(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: uploadBucket }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: uploadBucket }));
  }
  try {
    await s3.send(new PutBucketCorsCommand({
      Bucket: uploadBucket,
      CORSConfiguration: {
        CORSRules: [{
          AllowedHeaders: ["authorization", "content-type", "x-amz-*"],
          AllowedMethods: ["GET", "HEAD", "PUT"],
          AllowedOrigins: [process.env.FRONTEND_URL ?? "http://localhost:3000"],
          ExposeHeaders: ["ETag"],
          MaxAgeSeconds: 3600,
        }],
      },
    }));
  } catch (error) {
    process.stderr.write(`Could not apply bucket CORS policy: ${error instanceof Error ? error.message : "unknown storage error"}\n`);
  }
  void startEmailWorker().catch((error) => {
    process.stderr.write(`Email worker failed to start: ${error instanceof Error ? error.message : "unknown"}\n`);
  });
  app.listen(port, () => {
    process.stdout.write(`API listening on port ${port}\n`);
  });
}

void start().catch((error: unknown) => {
  process.stderr.write(`API startup failed: ${error instanceof Error ? error.message : "storage initialization error"}\n`);
  process.exit(1);
});

process.on("SIGINT", () => {
  void Promise.all([prisma.$disconnect(), redis.quit()]).finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void Promise.all([prisma.$disconnect(), redis.quit()]).finally(() => process.exit(0));
});
