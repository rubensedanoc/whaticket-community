import axios from "axios";

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  isOpen: boolean;
}

const GOOGLE_CHAT_WEBHOOK = process.env.GOOGLE_CHAT_WEBHOOK;
const THROTTLE_MS = 60000;
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_TIMEOUT = 300000;
const REQUEST_TIMEOUT = 5000;

const notificationThrottle = new Map<string, number>();
const circuitBreaker: CircuitBreakerState = {
  failures: 0,
  lastFailureTime: 0,
  isOpen: false
};

const shouldSendNotification = (errorType: string): boolean => {
  const lastSent = notificationThrottle.get(errorType);
  const now = Date.now();

  if (!lastSent || now - lastSent > THROTTLE_MS) {
    notificationThrottle.set(errorType, now);
    return true;
  }

  return false;
};

const checkCircuitBreaker = (): boolean => {
  const now = Date.now();

  if (circuitBreaker.isOpen) {
    if (now - circuitBreaker.lastFailureTime > CIRCUIT_BREAKER_TIMEOUT) {
      circuitBreaker.isOpen = false;
      circuitBreaker.failures = 0;
      console.log("[GoogleChatLog] Circuit breaker cerrado, reintentando conexión");
      return true;
    }
    return false;
  }

  return true;
};

const recordFailure = (): void => {
  circuitBreaker.failures++;
  circuitBreaker.lastFailureTime = Date.now();

  if (circuitBreaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    circuitBreaker.isOpen = true;
    console.log(
      `[GoogleChatLog] Circuit breaker abierto después de ${circuitBreaker.failures} fallos. Desactivado por ${CIRCUIT_BREAKER_TIMEOUT / 1000}s`
    );
  }
};

const recordSuccess = (): void => {
  circuitBreaker.failures = 0;
};

export const sendGoogleChatLog = async (
  message: string,
  errorType: string = "general"
): Promise<void> => {
  if (!GOOGLE_CHAT_WEBHOOK) {
    return;
  }

  if (!shouldSendNotification(errorType)) {
    return;
  }

  if (!checkCircuitBreaker()) {
    return;
  }

  setImmediate(async () => {
    try {
      await axios.post(
        GOOGLE_CHAT_WEBHOOK,
        { text: message },
        { timeout: REQUEST_TIMEOUT }
      );
      recordSuccess();
    } catch (err) {
      recordFailure();
      console.error("[GoogleChatLog] Error enviando a Google Chat:", err.message);
    }
  });
};

export const sendGoogleChatError = async (params: {
  service: string;
  error: string;
  details?: string;
  whatsappId?: number;
  ticketId?: number;
  contactNumber?: string;
}): Promise<void> => {
  const timestamp = new Date().toISOString();
  const message = `🚨 [ERROR] Whaticket Producción
Servicio: ${params.service}
Hora: ${timestamp}
${params.whatsappId ? `WhatsApp ID: ${params.whatsappId}\n` : ""}${params.ticketId ? `Ticket: #${params.ticketId}\n` : ""}${params.contactNumber ? `Contacto: ${params.contactNumber}\n` : ""}Error: ${params.error}
${params.details ? `Detalles: ${params.details}` : ""}`;

  await sendGoogleChatLog(message, `${params.service}:${params.error}`);
};

export const sendGoogleChatMetaError = async (params: {
  service: string;
  error: string;
  details?: string;
  whatsappId?: number;
  ticketId?: number;
  contactNumber?: string;
}): Promise<void> => {
  const timestamp = new Date().toISOString();
  const message = `⚠️ [META ERROR] Whaticket Producción
Servicio: ${params.service}
Hora: ${timestamp}
${params.whatsappId ? `WhatsApp ID: ${params.whatsappId}\n` : ""}${params.ticketId ? `Ticket: #${params.ticketId}\n` : ""}${params.contactNumber ? `Contacto: ${params.contactNumber}\n` : ""}Error: ${params.error}
${params.details ? `Detalles: ${params.details}` : ""}`;

  await sendGoogleChatLog(message, `meta:${params.service}:${params.error}`);
};

export const sendGoogleChatInfo = async (
  service: string,
  message: string
): Promise<void> => {
  const timestamp = new Date().toISOString();
  const formattedMessage = `ℹ️ [INFO] Whaticket Producción
Servicio: ${service}
Hora: ${timestamp}
Mensaje: ${message}`;

  await sendGoogleChatLog(formattedMessage, `info:${service}`);

};
