import { getWbot, searchForUnSaveMessages } from "../../libs/wbot";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import { logger } from "../../utils/logger";
import AppError from "../../errors/AppError";

interface ImportConnectionMessagesRequest {
  whatsappId: number;
  timeIntervalInHours?: number;
}

interface ImportConnectionMessagesResponse {
  whatsappId: number;
  connectionName: string;
  messagesImported: number;
  timeIntervalInHours: number;
  logs: any[];
  error: any;
}

const ImportConnectionMessagesService = async ({
  whatsappId,
  timeIntervalInHours = 24
}: ImportConnectionMessagesRequest): Promise<ImportConnectionMessagesResponse> => {
  logger.info(
    `[ImportConnectionMessages] START - whatsappId: ${whatsappId}, timeInterval: ${timeIntervalInHours}h`
  );

  // 1. Validar que la conexión existe
  const whatsapp = await ShowWhatsAppService(whatsappId);

  if (!whatsapp) {
    throw new AppError("ERR_WHATSAPP_NOT_FOUND", 404);
  }

  // Si la conexión no está conectada, esperar hasta 10 segundos por si está en transición
  if (whatsapp.status !== "CONNECTED") {
    logger.info(
      `[ImportConnectionMessages] Conexión en estado "${whatsapp.status}", esperando hasta 10s...`
    );

    let retries = 0;
    const maxRetries = 10;

    while (retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar 1 segundo
      await whatsapp.reload(); // Recargar desde BD

      if (whatsapp.status === "CONNECTED") {
        logger.info(
          `[ImportConnectionMessages] Conexión lista después de ${retries + 1}s`
        );
        break;
      }

      retries++;
    }

    if (whatsapp.status !== "CONNECTED") {
      throw new AppError(
        `La conexión "${whatsapp.name}" no está conectada. Estado actual: ${whatsapp.status}`,
        400
      );
    }
  }

  // 2. Obtener la sesión activa del wbot
  let wbot;
  try {
    wbot = getWbot(whatsappId);
  } catch (err) {
    throw new AppError(
      `No se pudo obtener la sesión de WhatsApp para "${whatsapp.name}". Verifique que esté inicializada.`,
      400
    );
  }

  // 3. Ejecutar la búsqueda e importación de mensajes faltantes
  // Reutiliza searchForUnSaveMessages que ya maneja:
  //   - Obtener todos los chats del wbot
  //   - Filtrar chats con actividad en el intervalo de tiempo
  //   - Fetch de mensajes por chat (gradual, hasta 1000)
  //   - Verificación contra BD (Message.findAll por IDs)
  //   - Filtro de mensajes válidos (isValidMsg)
  //   - Llamada a handleMessage para cada mensaje faltante (crea ticket/contacto/mensaje)
  const result = await searchForUnSaveMessages({
    wbot,
    whatsapp,
    timeIntervalInHours
  });

  logger.info(
    `[ImportConnectionMessages] END - whatsappId: ${whatsappId}, ` +
      `connection: "${whatsapp.name}", ` +
      `messagesImported: ${result.messagesCount}, ` +
      `error: ${result.error ? "YES" : "NO"}`
  );

  return {
    whatsappId,
    connectionName: whatsapp.name,
    messagesImported: result.messagesCount || 0,
    timeIntervalInHours,
    logs: result.logs,
    error: result.error
  };
};

export default ImportConnectionMessagesService;
