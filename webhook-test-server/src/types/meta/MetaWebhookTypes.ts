/**
 * Tipos básicos para Webhook de Meta WhatsApp Cloud API
 */

// Payload principal que llega al webhook
export interface MetaWebhookPayload {
  object: "whatsapp_business_account";
  entry: MetaWebhookEntry[];
}

export interface MetaWebhookEntry {
  id: string;
  changes: MetaWebhookChange[];
}

export interface MetaWebhookChange {
  value: MetaWebhookValue;
  field: "messages";
}

export interface MetaWebhookValue {
  messaging_product: "whatsapp";
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  messages?: MetaWebhookMessage[];
  statuses?: MetaWebhookStatus[];
}

// Mensaje entrante básico
export interface MetaWebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
}

// Estado de mensaje enviado
export interface MetaWebhookStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
}

// Query de verificación GET
export interface MetaWebhookVerifyQuery {
  "hub.mode": string;
  "hub.verify_token": string;
  "hub.challenge": string;
}
