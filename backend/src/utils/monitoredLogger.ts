import { logger } from "./logger";
import { sendGoogleChatError, sendGoogleChatInfo } from "../helpers/SendGoogleChatLog";

export const monitoredError = (
  service: string,
  message: string,
  error?: any,
  metadata?: {
    whatsappId?: number;
    ticketId?: number;
    contactNumber?: string;
    sendToChat?: boolean;
  }
): void => {
  logger.error(`[${service}] ${message}`, error);

  if (metadata?.sendToChat !== false) {
    const errorMessage = error?.message || error?.toString() || "Error desconocido";
    const errorStack = error?.stack ? error.stack.split("\n")[0] : undefined;

    sendGoogleChatError({
      service,
      error: message,
      details: errorStack || errorMessage,
      whatsappId: metadata?.whatsappId,
      ticketId: metadata?.ticketId,
      contactNumber: metadata?.contactNumber
    });
  }
};

export const monitoredWarn = (
  service: string,
  message: string,
  metadata?: {
    whatsappId?: number;
    sendToChat?: boolean;
  }
): void => {
  logger.warn(`[${service}] ${message}`);

  if (metadata?.sendToChat) {
    sendGoogleChatInfo(service, `⚠️ ${message}`);
  }
};

export const monitoredInfo = (
  service: string,
  message: string,
  sendToChat: boolean = false
): void => {
  logger.info(`[${service}] ${message}`);

  if (sendToChat) {
    sendGoogleChatInfo(service, message);
  }
};
