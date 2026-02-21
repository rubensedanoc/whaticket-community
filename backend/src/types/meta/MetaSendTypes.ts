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
  template?: MetaSendTemplate;
}

export type MetaSendMessageType = "text" | "image" | "audio" | "document" | "template";

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

// Template (plantilla)
export interface MetaSendTemplate {
  name: string;
  language: {
    code: string;
  };
  components?: MetaTemplateComponent[];
}

export interface MetaTemplateComponent {
  type: "header" | "body" | "button";
  parameters?: MetaTemplateParameter[];
  sub_type?: string;
  index?: number;
}

export interface MetaTemplateParameter {
  type: "text" | "currency" | "date_time" | "image" | "document" | "video";
  text?: string;
  currency?: {
    fallback_value: string;
    code: string;
    amount_1000: number;
  };
  date_time?: {
    fallback_value: string;
  };
  image?: {
    id?: string;
    link?: string;
  };
  document?: {
    id?: string;
    link?: string;
    filename?: string;
  };
  video?: {
    id?: string;
    link?: string;
  };
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

export interface SendTemplateParams {
  to: string;
  templateName: string;
  languageCode?: string;
  bodyParameters?: string[];
  headerParameters?: MetaTemplateParameter[];
  buttonParameters?: Array<{ index: number; parameters: MetaTemplateParameter[] }>;
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

export const buildTemplatePayload = (params: SendTemplateParams): MetaSendMessagePayload => {
  const components: MetaTemplateComponent[] = [];

  // Header parameters
  if (params.headerParameters && params.headerParameters.length > 0) {
    components.push({
      type: "header",
      parameters: params.headerParameters
    });
  }

  // Body parameters
  if (params.bodyParameters && params.bodyParameters.length > 0) {
    components.push({
      type: "body",
      parameters: params.bodyParameters.map(text => ({
        type: "text" as const,
        text
      }))
    });
  }

  // Button parameters
  if (params.buttonParameters && params.buttonParameters.length > 0) {
    params.buttonParameters.forEach(button => {
      components.push({
        type: "button",
        sub_type: "url",
        index: button.index,
        parameters: button.parameters
      });
    });
  }

  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: params.to,
    type: "template",
    template: {
      name: params.templateName,
      language: {
        code: params.languageCode || "es"
      },
      ...(components.length > 0 && { components })
    }
  };
};
