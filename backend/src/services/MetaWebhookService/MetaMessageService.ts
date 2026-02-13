import { logger } from "../../utils/logger";

export interface WhatsAppMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  button?: { text: string; payload: string };
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  image?: {
    id: string;
    mime_type: string;
    sha256: string;
    caption?: string;
  };
  video?: {
    id: string;
    mime_type: string;
    sha256: string;
    caption?: string;
  };
  document?: {
    id: string;
    mime_type: string;
    sha256: string;
    filename?: string;
    caption?: string;
  };
  audio?: {
    id: string;
    mime_type: string;
    sha256: string;
  };
  sticker?: {
    id: string;
    mime_type: string;
    sha256: string;
  };
}

export interface WhatsAppContact {
  profile: {
    name: string;
  };
  wa_id: string;
}

export interface WhatsAppMetadata {
  display_phone_number: string;
  phone_number_id: string;
}

export interface WhatsAppValue {
  messaging_product: string;
  metadata: WhatsAppMetadata;
  contacts?: WhatsAppContact[];
  messages?: WhatsAppMessage[];
  statuses?: Array<{
    id: string;
    status: string;
    timestamp: string;
    recipient_id: string;
  }>;
}

export interface ProcessedMessage {
  from: string;
  text: string;
  type: string;
  messageId: string;
  timestamp: string;
  contactName?: string;
  metadata: {
    phoneNumberId: string;
    businessNumber: string;
  };
  rawMessage: WhatsAppMessage;
}

export interface MessageStatus {
  messageId: string;
  status: string;
  recipientId: string;
  timestamp: string;
}

class MetaMessageService {
  extractMessageText(message: WhatsAppMessage): string {
    let text = "";

    switch (message.type) {
      case "text":
        text = message.text?.body || "";
        break;

      case "button":
        text = message.button?.text || "";
        break;

      case "interactive":
        if (message.interactive?.type === "button_reply") {
          text = message.interactive.button_reply?.title || "";
        } else if (message.interactive?.type === "list_reply") {
          text = message.interactive.list_reply?.title || "";
        }
        break;

      case "location":
        if (message.location) {
          text = `Location: ${message.location.latitude}, ${message.location.longitude}`;
          if (message.location.name) {
            text += ` - ${message.location.name}`;
          }
        }
        break;

      case "image":
        text = message.image?.caption || "[Image]";
        break;

      case "video":
        text = message.video?.caption || "[Video]";
        break;

      case "document":
        text = message.document?.caption || `[Document: ${message.document?.filename || "file"}]`;
        break;

      case "audio":
        text = "[Audio]";
        break;

      case "sticker":
        text = "[Sticker]";
        break;

      default:
        logger.warn(`Unknown message type: ${message.type}`);
        text = `[Unsupported message type: ${message.type}]`;
    }

    return text;
  }

  processMessage(message: WhatsAppMessage, value: WhatsAppValue): ProcessedMessage {

    const extractedText = this.extractMessageText(message);
    const contactInfo = value.contacts?.[0];
    const metadata = value.metadata;

    const processedMessage: ProcessedMessage = {
      from: message.from,
      text: extractedText,
      type: message.type,
      messageId: message.id,
      timestamp: message.timestamp,
      contactName: contactInfo?.profile?.name,
      metadata: {
        phoneNumberId: metadata?.phone_number_id,
        businessNumber: metadata?.display_phone_number
      },
      rawMessage: message
    };

    logger.info("Message processed", {
      from: processedMessage.from,
      contactName: processedMessage.contactName,
      type: processedMessage.type,
      messageId: processedMessage.messageId,
      text: processedMessage.text,
      phoneNumberId: processedMessage.metadata.phoneNumberId,
      businessNumber: processedMessage.metadata.businessNumber,
      timestamp: processedMessage.timestamp
    });

    return processedMessage;
  }

  processMessageStatus(status: {
    id: string;
    status: string;
    timestamp: string;
    recipient_id: string;
  }): MessageStatus {
    const messageStatus: MessageStatus = {
      messageId: status.id,
      status: status.status,
      recipientId: status.recipient_id,
      timestamp: status.timestamp
    };

    logger.info("Message status processed", messageStatus);

    return messageStatus;
  }

  async handleIncomingMessage(processedMessage: ProcessedMessage): Promise<void> {
    // TODO: Implementar lógica de negocio aquí
    // Ejemplos:
    // - Crear o actualizar contacto
    // - Crear ticket/conversación
    // - Guardar mensaje en base de datos
    // - Procesar comandos del chatbot
    // - Enviar respuesta automática

    logger.info("Handling incoming message", {
      from: processedMessage.from,
      text: processedMessage.text
    });

    // Ejemplo de lo que podrías hacer:
    // await CreateOrUpdateContactService({
    //   name: processedMessage.contactName || processedMessage.from,
    //   number: processedMessage.from,
    //   isGroup: false
    // });

    // await CreateMessageService({
    //   messageId: processedMessage.messageId,
    //   body: processedMessage.text,
    //   fromMe: false,
    //   contactId: contact.id,
    //   timestamp: processedMessage.timestamp
    // });
  }

  async handleMessageStatus(messageStatus: MessageStatus): Promise<void> {
    // TODO: Actualizar estado del mensaje en la base de datos

    logger.info("Handling message status update", messageStatus);

    // Ejemplo:
    // await UpdateMessageStatusService({
    //   messageId: messageStatus.messageId,
    //   status: messageStatus.status
    // });
  }
}

export default new MetaMessageService();
