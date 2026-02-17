/**
 * Tipos de respuesta y errores - Meta WhatsApp Cloud API
 */

// Respuesta exitosa al enviar mensaje
export interface MetaApiSuccessResponse {
  messaging_product: "whatsapp";
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
  }>;
}

// Error de la API de Meta
export interface MetaApiErrorResponse {
  error: MetaApiError;
}

export interface MetaApiError {
  message: string;
  type: string;
  code: number;
  error_subcode?: number;
  error_data?: {
    messaging_product?: string;
    details?: string;
  };
  fbtrace_id?: string;
}

// Códigos de error comunes
export enum MetaErrorCode {
  // Autenticación
  INVALID_ACCESS_TOKEN = 190,
  ACCESS_TOKEN_EXPIRED = 190,
  
  // Parámetros
  INVALID_PARAMETER = 100,
  
  // Rate limiting
  RATE_LIMIT_REACHED = 130429,
  SPAM_RATE_LIMIT = 131048,
  
  // Mensajes
  MESSAGE_FAILED_TO_SEND = 131000,
  RECIPIENT_NOT_VALID_WHATSAPP_USER = 131026,
  RECIPIENT_CANNOT_BE_SENDER = 131021,
  PHONE_NUMBER_NOT_REGISTERED = 131030,
  
  // Media
  MEDIA_DOWNLOAD_ERROR = 131052,
  MEDIA_UPLOAD_ERROR = 131053,
  INVALID_MEDIA_ID = 131051,
  MEDIA_FILE_TOO_LARGE = 131054,
  UNSUPPORTED_MEDIA_TYPE = 131055,
  
  // Templates
  TEMPLATE_NOT_FOUND = 132000,
  TEMPLATE_PARAM_COUNT_MISMATCH = 132001,
  TEMPLATE_PARAM_FORMAT_MISMATCH = 132012,
  TEMPLATE_PAUSED = 132015,
  TEMPLATE_DISABLED = 132016,
  
  // Cuenta
  BUSINESS_ACCOUNT_LOCKED = 131031,
  UNVERIFIED_BUSINESS = 131042,
  
  // Webhook
  UNSUPPORTED_MESSAGE_TYPE = 130501
}

// Respuesta de subida de media
export interface MetaMediaUploadResponse {
  id: string;
}

// Respuesta de obtener URL de media
export interface MetaMediaUrlResponse {
  url: string;
  mime_type: string;
  sha256: string;
  file_size: number;
  id: string;
  messaging_product: "whatsapp";
}

// Helper para verificar si es error
export const isMetaApiError = (response: unknown): response is MetaApiErrorResponse => {
  return typeof response === "object" && response !== null && "error" in response;
};

// Helper para extraer mensaje de error legible
export const getErrorMessage = (error: MetaApiError): string => {
  if (error.error_data?.details) {
    return `${error.message}: ${error.error_data.details}`;
  }
  return error.message;
};
