import * as Sentry from "@sentry/node";
import axios from "axios";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import AppError from "../../errors/AppError";

const writeFileAsync = promisify(fs.writeFile);

interface DownloadMetaMediaParams {
  mediaId: string;
  accessToken: string;
  mimeType: string;
}

interface DownloadMetaMediaResult {
  filename: string;
  mediaType: string;
}

/**
 * Descarga media desde Meta API y lo guarda en /public
 *
 * Flujo:
 * 1. GET a Meta API para obtener URL del media
 * 2. Descargar archivo desde la URL
 * 3. Guardar en /public con nombre único
 * 4. Retornar filename y mediaType
 */
const DownloadMetaMedia = async ({
  mediaId,
  accessToken,
  mimeType
}: DownloadMetaMediaParams): Promise<DownloadMetaMediaResult> => {
  try {
    console.log("[DownloadMetaMedia] Iniciando descarga");
    console.log("[DownloadMetaMedia] MediaId:", mediaId);
    console.log("[DownloadMetaMedia] MimeType:", mimeType);

    // Paso 1: Obtener URL del media desde Meta API
    const metaApiBaseUrl = process.env.META_API_BASE_URL || "https://graph.facebook.com";
    const metaApiVersion = process.env.META_API_VERSION || "v22.0";
    const metaApiUrl = `${metaApiBaseUrl}/${metaApiVersion}/${mediaId}`;
    console.log("[DownloadMetaMedia] Obteniendo URL del media...");

    const metaResponse = await axios.get(metaApiUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const mediaUrl = metaResponse.data.url;
    console.log("[DownloadMetaMedia] URL obtenida:", mediaUrl);

    // Paso 2: Descargar el archivo desde la URL
    console.log("[DownloadMetaMedia] Descargando archivo...");
    const fileResponse = await axios.get(mediaUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      responseType: "arraybuffer"
    });

    // Paso 3: Generar nombre único para el archivo
    const mediaType = mimeType.split("/")[0]; // image, audio, video, application
    const extension = getExtensionFromMimeType(mimeType);
    const timestamp = Date.now();
    const filename = `${mediaType}-${timestamp}${extension}`;

    // Paso 4: Guardar en /public
    const publicPath = path.join(__dirname, "..", "..", "..", "public");
    const filePath = path.join(publicPath, filename);

    // Crear directorio /public si no existe
    if (!fs.existsSync(publicPath)) {
      fs.mkdirSync(publicPath, { recursive: true });
    }

    await writeFileAsync(filePath, fileResponse.data);

    console.log("[DownloadMetaMedia] Archivo guardado:", filename);
    console.log("[DownloadMetaMedia] Path completo:", filePath);

    return {
      filename,
      mediaType
    };

  } catch (err) {
    console.error("[DownloadMetaMedia] Error:", err);
    console.error("[DownloadMetaMedia] Error Message:", err.message);
    if (err.response) {
      console.error("[DownloadMetaMedia] Error Response:", err.response.data);
    }
    Sentry.captureException(err);
    throw new AppError("ERR_DOWNLOADING_META_MEDIA");
  }
};

/**
 * Obtiene la extensión del archivo según el mimeType
 */
const getExtensionFromMimeType = (mimeType: string): string => {
  // Limpiar mimeType (remover codecs y parámetros adicionales)
  const cleanMimeType = mimeType.split(";")[0].trim();

  const mimeToExt: Record<string, string> = {
    // Images
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",

    // Audio
    "audio/aac": ".aac",
    "audio/mp4": ".m4a",
    "audio/mpeg": ".mp3",
    "audio/amr": ".amr",
    "audio/ogg": ".ogg",

    // Video
    "video/mp4": ".mp4",
    "video/3gpp": ".3gp",

    // Documents
    "application/pdf": ".pdf",
    "application/vnd.ms-powerpoint": ".ppt",
    "application/msword": ".doc",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "text/plain": ".txt"
  };

  return mimeToExt[cleanMimeType] || ".bin";
};

export default DownloadMetaMedia;
