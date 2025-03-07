import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync, readdirSync } from "fs";
import dotenv from "dotenv";
import { join } from "path";
import mime from "mime-types";

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION', 'S3_BUCKET_NAME'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});
const BUCKET_NAME = process.env.S3_BUCKET_NAME!;
const DIST_FOLDER = "./dist";

async function uploadFile(filePath: string, bucketPath: string) {
  const fileContent = readFileSync(filePath);
  const contentType = mime.lookup(filePath) || "application/octet-stream";

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: bucketPath,
    Body: fileContent,
    ContentType: contentType,
  });

  try {
    await s3Client.send(command);
    console.log(`Uploaded: ${bucketPath}`);
  } catch (err) {
    console.error(`Failed to upload ${bucketPath}:`, err);
  }
}

async function uploadDirectory(dirPath: string, bucketPath = "") {
  const files = readdirSync(dirPath, { withFileTypes: true });

  for (const file of files) {
    const fullPath = join(dirPath, file.name);
    const s3Path = join(bucketPath, file.name).replace(/\\/g, "/");

    if (file.isDirectory()) {
      await uploadDirectory(fullPath, s3Path);
    } else {
      await uploadFile(fullPath, s3Path);
    }
  }
}

uploadDirectory(DIST_FOLDER)
  .then(() => console.log("Deployment complete!"))
  .catch(console.error);