import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import fs from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import {
  assertS3Config,
  awsRegion,
  isLocalStorage,
  isS3Storage,
  localPublicDirectory,
  s3BackupPrefix,
  s3BucketName,
  s3EndpointUrl
} from "../../config/storage";

const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);
const mkdirAsync = promisify(fs.mkdir);

export const isAbsoluteUrl = (value?: string | null): boolean => {
  if (!value) return false;
  return /^https?:\/\//i.test(value);
};

const sanitizeBaseName = (baseName: string): string => {
  return baseName
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 100);
};

const getExtension = (originalName: string, mimeType?: string): string => {
  const originalExt = path.extname(originalName || "");
  if (originalExt) return originalExt;

  if (mimeType?.startsWith("image/")) return ".jpg";
  if (mimeType?.startsWith("audio/")) return ".ogg";
  if (mimeType?.startsWith("video/")) return ".mp4";
  if (mimeType === "application/pdf") return ".pdf";
  return ".bin";
};

export const generateStorageFilename = (
  originalName: string,
  mimeType?: string
): string => {
  const base = sanitizeBaseName(path.basename(originalName || "file", path.extname(originalName || "")) || "file");
  const ext = getExtension(originalName, mimeType);
  return `${base}-${Date.now()}${ext}`;
};

const withPrefix = (fileName: string, prefix?: string): string => {
  const normalizedPrefix = (prefix ?? s3BackupPrefix ?? "").trim().replace(/^\/+|\/+$/g, "");
  if (!normalizedPrefix) return fileName;
  return `${normalizedPrefix}/${fileName}`;
};

const s3Client = isS3Storage
  ? new S3Client({
      region: awsRegion,
      ...(s3EndpointUrl
        ? {
            endpoint: s3EndpointUrl,
            forcePathStyle: true
          }
        : {})
    })
  : null;

const toS3PublicUrl = (key: string): string => {
  const cleanKey = key.replace(/^\/+/, "");
  if (s3EndpointUrl) {
    return `${s3EndpointUrl.replace(/\/+$/, "")}/${s3BucketName}/${cleanKey}`;
  }
  return `https://${s3BucketName}.s3.${awsRegion}.amazonaws.com/${cleanKey}`;
};

const extractS3KeyFromUrl = (url: string): string => {
  if (!isAbsoluteUrl(url)) return url;

  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.replace(/^\/+/, "");

    // path-style (endpoint/bucket/key)
    if (pathname.startsWith(`${s3BucketName}/`)) {
      return pathname.slice(s3BucketName.length + 1);
    }

    // virtual-host-style (bucket.s3.region.amazonaws.com/key)
    return pathname;
  } catch (_error) {
    return url;
  }
};

const ensureDirectory = async (dirPath: string): Promise<void> => {
  if (!fs.existsSync(dirPath)) {
    await mkdirAsync(dirPath, { recursive: true });
  }
};

export const persistBufferFile = async ({
  buffer,
  originalName,
  mimeType,
  prefix
}: {
  buffer: Buffer;
  originalName: string;
  mimeType?: string;
  prefix?: string;
}): Promise<string> => {
  const fileName = generateStorageFilename(originalName, mimeType);

  if (isLocalStorage) {
    await ensureDirectory(localPublicDirectory);
    await writeFileAsync(path.join(localPublicDirectory, fileName), buffer);
    return fileName;
  }

  assertS3Config();

  const key = withPrefix(fileName, prefix);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: s3BucketName,
      Key: key,
      Body: buffer,
      ContentType: mimeType || "application/octet-stream"
    })
  );

  return key;
};

export const persistMulterFile = async (
  file: Express.Multer.File,
  prefix?: string
): Promise<string> => {
  if (isLocalStorage) {
    return file.filename || generateStorageFilename(file.originalname, file.mimetype);
  }

  if (!file?.buffer) {
    throw new Error("No hay buffer de archivo disponible para subir a S3");
  }

  return persistBufferFile({
    buffer: file.buffer,
    originalName: file.originalname,
    mimeType: file.mimetype,
    prefix
  });
};

export const getStoragePublicUrl = (storedValue?: string | null): string | null => {
  if (!storedValue) return null;
  if (isAbsoluteUrl(storedValue)) return storedValue;

  if (isS3Storage) {
    return toS3PublicUrl(storedValue);
  }

  return `${process.env.BACKEND_URL}:${process.env.PROXY_PORT}/public/${storedValue}`;
};

const downloadS3ObjectToTemp = async (key: string): Promise<string> => {
  assertS3Config();

  const command = new GetObjectCommand({ Bucket: s3BucketName, Key: key });
  const result = await s3Client.send(command);

  const chunks: Buffer[] = [];
  const stream = result.Body as any;

  await new Promise<void>((resolve, reject) => {
    stream.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on("error", reject);
    stream.on("end", () => resolve());
  });

  const ext = path.extname(key) || ".bin";
  const tempPath = path.join(os.tmpdir(), `whaticket-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  await writeFileAsync(tempPath, Buffer.concat(chunks));
  return tempPath;
};

export const resolveStoredFileToLocalPath = async (
  storedValue: string
): Promise<{ localPath: string; cleanup: () => Promise<void> }> => {
  if (isLocalStorage) {
    const localName = isAbsoluteUrl(storedValue)
      ? path.basename(new URL(storedValue).pathname)
      : path.basename(storedValue);

    return {
      localPath: path.join(localPublicDirectory, localName),
      cleanup: async () => undefined
    };
  }

  const s3Key = extractS3KeyFromUrl(storedValue);
  const tempFile = await downloadS3ObjectToTemp(s3Key);

  return {
    localPath: tempFile,
    cleanup: async () => {
      if (fs.existsSync(tempFile)) {
        await unlinkAsync(tempFile);
      }
    }
  };
};

export const ensureMulterFileLocalPath = async (
  file: Express.Multer.File
): Promise<{ localPath: string; cleanup: () => Promise<void> }> => {
  if (file.path && fs.existsSync(file.path)) {
    return {
      localPath: file.path,
      cleanup: async () => undefined
    };
  }

  if (!file.buffer) {
    throw new Error("No hay path ni buffer disponible para el archivo");
  }

  const tempFileName = generateStorageFilename(file.originalname, file.mimetype);
  const tempPath = path.join(os.tmpdir(), `whaticket-upload-${tempFileName}`);
  await writeFileAsync(tempPath, file.buffer);

  return {
    localPath: tempPath,
    cleanup: async () => {
      if (fs.existsSync(tempPath)) {
        await unlinkAsync(tempPath);
      }
    }
  };
};
