import path from "path";

export type StorageType = "local" | "s3";

const rawStorageType = (process.env.STORAGE_TYPE || "local").toLowerCase();

export const storageType: StorageType = rawStorageType === "s3" ? "s3" : "local";
export const isS3Storage = storageType === "s3";
export const isLocalStorage = storageType === "local";

export const localPublicDirectory = path.resolve(__dirname, "..", "..", "public");

export const awsRegion =
  process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";

export const s3BucketName =
  process.env.S3_BUCKET || process.env.AWS_BUCKET_NAME || "";

export const s3BackupPrefix = process.env.S3_BACKUP_PREFIX || "";
export const s3EndpointUrl = process.env.S3_ENDPOINT_URL || "";

export const assertS3Config = (): void => {
  if (!s3BucketName) {
    throw new Error(
      "S3 bucket no configurado. Define S3_BUCKET (o AWS_BUCKET_NAME legacy) en .env"
    );
  }

  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error(
      "Credenciales AWS incompletas. Define AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY en .env"
    );
  }
};
