import "dotenv/config";
import { CreateBucketCommand, HeadBucketCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { app } from "./app";
import { prisma } from "./config/database";
import { redis } from "./config/redis";
import { s3, uploadBucket } from "./config/storage";

const port = Number(process.env.PORT ?? 5000);

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
