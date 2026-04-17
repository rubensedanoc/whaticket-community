/**
 * Tipos para Webhook de Meta WhatsApp Cloud API
 * Basado en: WhatsApp Cloud API Postman Collection - Webhook Payload Reference
 */

// ============================================
// PAYLOAD PRINCIPAL
// ============================================

export interface MetaWebhookPayload {
  object: "whatsapp_business_account";
  entry: MetaWebhookEntry[];
}

export interface MetaWebhookEntry {
  id: string; // WhatsApp Business Account ID
  changes: MetaWebhookChange[];
}

export interface MetaWebhookChange {
  value: MetaWebhookValue;
  field: "messages";
}

export interface MetaWebhookValue {
  messaging_product: "whatsapp";
  metadata: MetaWebhookMetadata;
  contacts?: MetaWebhookContact[];
  messages?: MetaWebhookMessage[];
  statuses?: MetaWebhookStatus[];
  errors?: MetaWebhookError[];
}

// ============================================
// METADATA
// ============================================

export interface MetaWebhookMetadata {
  display_phone_number: string;
  phone_number_id: string;
}

// ============================================
// CONTACTO DEL REMITENTE
// ============================================

export interface MetaWebhookContact {
  profile: {
    name?: string;
  };
  wa_id: string;
}

// ============================================
// MENSAJE ENTRANTE
// ============================================

export type MetaWebhookMessageType =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "document"
  | "sticker"
  | "location"
  | "contacts"
  | "interactive"
  | "button"
  | "reaction"
  | "order"
  | "system"
  | "unsupported"
  | "unknown";

export interface MetaWebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: MetaWebhookMessageType;
  group_id?: string; // Identifica mensajes de grupos (presente solo en mensajes grupales)
  // Contenido según tipo
  text?: MetaTextObject;
  image?: MetaMediaObject;
  audio?: MetaMediaObject;
  video?: MetaMediaObject;
  document?: MetaDocumentObject;
  sticker?: MetaStickerObject;
  interactive?: MetaInteractiveObject;
  button?: MetaButtonObject;
  // TODO: Agregar cuando se necesiten
  // location?: MetaLocationObject;
  // contacts?: MetaContactObject[];
  // reaction?: MetaReactionObject;
  // Contexto (si es respuesta o reenviado)
  context?: MetaContextObject;
  // Identidad (si show_security_notifications está habilitado)
  identity?: MetaIdentityObject;
  // Errores en el mensaje
  errors?: MetaWebhookError[];
  // Referral (si viene de Click to WhatsApp Ads)
  referral?: MetaReferralObject;
}

// ============================================
// OBJETOS DE CONTENIDO
// ============================================

// Texto
export interface MetaTextObject {
  body: string;
}

// Media (imagen, audio, video)
export interface MetaMediaObject {
  id: string;
  mime_type: string;
  sha256: string;
  caption?: string;
}

// Documento
export interface MetaDocumentObject {
  id: string;
  mime_type: string;
  sha256: string;
  filename?: string;
  caption?: string;
}

// Sticker
export interface MetaStickerObject {
  id: string;
  mime_type: string;
  sha256: string;
  animated?: boolean;
}

// Interactive (respuesta de mensajes interactivos)
export interface MetaInteractiveObject {
  type: "button_reply" | "list_reply";
  button_reply?: MetaButtonReply;
  list_reply?: MetaListReply;
}

export interface MetaButtonReply {
  id: string;
  title: string;
}

export interface MetaListReply {
  id: string;
  title: string;
  description?: string;
}

// Botón de plantilla (quick reply)
export interface MetaButtonObject {
  payload: string;
  text: string;
}

// Contexto (mensaje reenviado o respuesta)
export interface MetaContextObject {
  forwarded?: boolean;
  frequently_forwarded?: boolean;
  from?: string;
  id?: string;
  referred_product?: {
    catalog_id: string;
    product_retailer_id: string;
  };
}

// Identidad
export interface MetaIdentityObject {
  acknowledged: boolean;
  created_timestamp: number;
  hash: string;
}

// Referral (Click to WhatsApp Ads)
export interface MetaReferralObject {
  source_url: string;
  source_type: "ad" | "post";
  source_id: string;
  headline?: string;
  body?: string;
  media_type?: "image" | "video";
  image_url?: string;
  video_url?: string;
  thumbnail_url?: string;
}

// ============================================
// ESTADOS DE MENSAJE
// ============================================

export interface MetaWebhookStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed" | "deleted";
  timestamp: string;
  recipient_id: string;
  recipient_type?: "individual" | "group"; // Tipo de destinatario (presente en mensajes a grupos)
  conversation?: MetaConversationObject;
  pricing?: MetaPricingObject;
  errors?: MetaWebhookError[];
}

export interface MetaConversationObject {
  id: string;
  origin?: {
    type: "user_initiated" | "business_initiated" | "referral_conversion";
  };
  expiration_timestamp?: number;
}

export interface MetaPricingObject {
  pricing_model: "CBP" | "NBP";
  billable: boolean;
  category?: "user_initiated" | "business_initiated" | "referral_conversion";
}

// ============================================
// ERRORES
// ============================================

export interface MetaWebhookError {
  code: number;
  title: string;
  details?: string;
}

// ============================================
// VERIFICACIÓN WEBHOOK (GET)
// ============================================

export interface MetaWebhookVerifyQuery {
  "hub.mode": string;
  "hub.verify_token": string;
  "hub.challenge": string;
}

// ============================================
// TODO: TIPOS PENDIENTES DE IMPLEMENTAR
// ============================================

// export interface MetaLocationObject {
//   latitude: string;
//   longitude: string;
//   name?: string;
//   address?: string;
// }

// export interface MetaContactObject { ... }

// export interface MetaButtonObject {
//   payload: string;
//   text: string;
// }

// export interface MetaReactionObject {
//   message_id: string;
//   emoji: string;
// }
