import { S3Client } from "@aws-sdk/client-s3";

export const uploadBucket = process.env.S3_BUCKET_NAME ?? "jobportal-uploads";
export const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "us-east-1",
  ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}),
  ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? { credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY } }
    : {}),
});

export const s3Presign = process.env.S3_PUBLIC_ENDPOINT
  ? new S3Client({
      region: process.env.AWS_REGION ?? "us-east-1",
      endpoint: process.env.S3_PUBLIC_ENDPOINT,
      forcePathStyle: true,
      ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? { credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY } }
        : {}),
    })
  : s3;
