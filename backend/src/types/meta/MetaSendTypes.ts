/**
 * Tipos para envío de mensajes - Meta WhatsApp Cloud API
 */

// Payload principal
export interface MetaSendMessagePayload {
  messaging_product: "whatsapp";
  recipient_type?: "individual";
  to: string;
  type: MetaSendMessageType;
  context?: MetaSendContext;
  text?: MetaSendText;
  image?: MetaSendMedia;
  audio?: MetaSendMedia;
  document?: MetaSendDocument;
}

export type MetaSendMessageType = "text" | "image" | "audio" | "document";

// Contexto para reply
export interface MetaSendContext {
  message_id: string;
}

// Objetos de contenido
export interface MetaSendText {
  body: string;
  preview_url?: boolean;
}

export interface MetaSendMedia {
  id?: string;
  link?: string;
  caption?: string;
}

export interface MetaSendDocument {
  id?: string;
  link?: string;
  caption?: string;
  filename?: string;
}

// Respuesta de Meta API
export interface MetaSendMessageResponse {
  messaging_product: "whatsapp";
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

// Params simplificados para uso interno
export interface SendTextParams {
  to: string;
  body: string;
  previewUrl?: boolean;
  replyToMessageId?: string;
}

export interface SendImageParams {
  to: string;
  mediaId?: string;
  mediaUrl?: string;
  caption?: string;
  replyToMessageId?: string;
}

export interface SendAudioParams {
  to: string;
  mediaId?: string;
  mediaUrl?: string;
  replyToMessageId?: string;
}

export interface SendDocumentParams {
  to: string;
  mediaId?: string;
  mediaUrl?: string;
  filename?: string;
  caption?: string;
  replyToMessageId?: string;
}

// Builders
export const buildTextPayload = (params: SendTextParams): MetaSendMessagePayload => ({
  messaging_product: "whatsapp",
  recipient_type: "individual",
  to: params.to,
  type: "text",
  text: {
    body: params.body,
    preview_url: params.previewUrl ?? false
  },
  ...(params.replyToMessageId && { context: { message_id: params.replyToMessageId } })
});

export const buildImagePayload = (params: SendImageParams): MetaSendMessagePayload => ({
  messaging_product: "whatsapp",
  recipient_type: "individual",
  to: params.to,
  type: "image",
  image: {
    ...(params.mediaId && { id: params.mediaId }),
    ...(params.mediaUrl && { link: params.mediaUrl }),
    ...(params.caption && { caption: params.caption })
  },
  ...(params.replyToMessageId && { context: { message_id: params.replyToMessageId } })
});

export const buildAudioPayload = (params: SendAudioParams): MetaSendMessagePayload => ({
  messaging_product: "whatsapp",
  recipient_type: "individual",
  to: params.to,
  type: "audio",
  audio: {
    ...(params.mediaId && { id: params.mediaId }),
    ...(params.mediaUrl && { link: params.mediaUrl })
  },
  ...(params.replyToMessageId && { context: { message_id: params.replyToMessageId } })
});

export const buildDocumentPayload = (params: SendDocumentParams): MetaSendMessagePayload => ({
  messaging_product: "whatsapp",
  recipient_type: "individual",
  to: params.to,
  type: "document",
  document: {
    ...(params.mediaId && { id: params.mediaId }),
    ...(params.mediaUrl && { link: params.mediaUrl }),
    ...(params.filename && { filename: params.filename }),
    ...(params.caption && { caption: params.caption })
  },
  ...(params.replyToMessageId && { context: { message_id: params.replyToMessageId } })
});
