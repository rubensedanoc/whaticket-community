import * as Sentry from "@sentry/node";
import ChatbotMessage from "../../../models/ChatbotMessage";
import Whatsapp from "../../../models/Whatsapp";
import ProactiveBotSession from "../../../models/ProactiveBotSession";
import { MetaApiClient } from "../../../clients/MetaApiClient";
import Ticket from "../../../models/Ticket";
import Message from "../../../models/Message";
import CreateOrUpdateContactService from "../../ContactServices/CreateOrUpdateContactService";

interface SendInactivityBotMessageMetaParams {
  numbers: string[];
}

interface SendInactivityBotMessageMetaResult {
  success: number;
  failed: number;
  errors: Array<{
    number: string;
    error: string;
  }>;
}

const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

const SendInactivityBotMessageMeta = async ({
  numbers
}: SendInactivityBotMessageMetaParams): Promise<SendInactivityBotMessageMetaResult> => {
  const result: SendInactivityBotMessageMetaResult = {
    success: 0,
    failed: 0,
    errors: []
  };

  try {
    console.log(`[SendInactivityBotMessageMeta] Iniciando envío para ${numbers.length} números`);

    // 1. Buscar configuración del bot proactivo
    const whatsapp = await Whatsapp.findOne({
      where: {
        chatbotIdentifier: 'inactividad',
        executionType: 'proactive',
        status: 'CONNECTED'
      }
    });

    if (!whatsapp) {
      const error = 'No se encontró número WhatsApp con chatbotIdentifier="inactividad" y executionType="proactive"';
      console.error(`[SendInactivityBotMessageMeta] ${error}`);
      throw new Error(error);
    }

    console.log(`[SendInactivityBotMessageMeta] Whatsapp encontrado: ${whatsapp.id} - ${whatsapp.number}`);

    // 2. Validar credenciales Meta
    if (!whatsapp.phoneNumberId || !whatsapp.metaAccessToken) {
      const error = 'Credenciales Meta no configuradas en el número de inactividad';
      console.error(`[SendInactivityBotMessageMeta] ${error}`);
      throw new Error(error);
    }

    // 3. Buscar nodo raíz del bot
    const rootChatbotMessage = await ChatbotMessage.findOne({
      where: {
        identifier: 'inactividad',
        isActive: true,
        wasDeleted: false
      }
    });

    if (!rootChatbotMessage) {
      const error = 'No se encontró ChatbotMessage raíz con identifier="inactividad"';
      console.error(`[SendInactivityBotMessageMeta] ${error}`);
      throw new Error(error);
    }

    console.log(`[SendInactivityBotMessageMeta] Usando plantilla estándar de validación: encuesta_inactividad`);

    // 5. Crear cliente Meta API
    const client = new MetaApiClient({
      phoneNumberId: whatsapp.phoneNumberId,
      accessToken: whatsapp.metaAccessToken
    });

    // 6. Procesar cada número
    const delayBetweenMessages = parseInt(process.env.PROACTIVE_BOT_SEND_DELAY_MS || '20000');

    for (let i = 0; i < numbers.length; i++) {
      const number = numbers[i].replace(/\D/g, '').trim();

      try {
        console.log(`[SendInactivityBotMessageMeta] Procesando ${i + 1}/${numbers.length}: ${number}`);

        // 6.1. Crear/actualizar contacto
        const contact = await CreateOrUpdateContactService({
          name: number,
          number: number,
          isGroup: false,
          email: "",
          profilePicUrl: ""
        });

        console.log(`[SendInactivityBotMessageMeta] Contact creado/actualizado: ${contact.id}`);

        // 6.2. Verificar si ya existe un ticket abierto para este contacto
        const existingTicket = await Ticket.findOne({
          where: {
            contactId: contact.id,
            whatsappId: whatsapp.id,
            status: 'open'
          }
        });

        if (existingTicket) {
          console.log(`[SendInactivityBotMessageMeta] Ya existe ticket abierto para ${number}, saltando`);
          result.errors.push({
            number,
            error: 'Ya existe ticket abierto para este contacto'
          });
          result.failed++;
          continue;
        }

        // 6.3. Enviar plantilla estándar de validación PRIMERO
        const response = await client.sendTemplate({
          to: number,
          templateName: process.env.PROACTIVE_BOT_TEMPLATE_NAME || 'encuesta_inactividad',
          languageCode: 'es'
        });

        const messageId = response.messages[0].id;
        console.log(`[SendInactivityBotMessageMeta] Template enviado: ${messageId}`);

        // 6.4. Crear Ticket DESPUÉS de envío exitoso
        const ticket = await Ticket.create({
          contactId: contact.id,
          whatsappId: whatsapp.id,
          status: 'open',
          chatbotMessageIdentifier: whatsapp.chatbotIdentifier,
          chatbotMessageLastStep: null,
          chatbotFinishedAt: null,
          lastBotMessageAt: new Date(),
          isGroup: false,
          unreadMessages: 0
        });

        console.log(`[SendInactivityBotMessageMeta] Ticket creado: ${ticket.id}`);

        // 6.4.1. Guardar mensaje de plantilla en la base de datos
        await Message.create({
          id: messageId,
          ticketId: ticket.id,
          contactId: contact.id,
          body: `[Plantilla] ${process.env.PROACTIVE_BOT_TEMPLATE_NAME || 'encuesta_inactividad'}`,
          fromMe: true,
          mediaType: "chat",
          read: true,
          ack: 1
        });

        console.log(`[SendInactivityBotMessageMeta] Mensaje de plantilla guardado: ${messageId}`);

        // 6.5. Crear ProactiveBotSession para historial y reportes
        const session = await ProactiveBotSession.create({
          phone: number,
          whatsappId: whatsapp.id,
          ticketId: ticket.id,
          botIdentifier: whatsapp.chatbotIdentifier,
          status: 'ACTIVE',
          currentStep: 'AWAITING_VALIDATION',
          userResponsesHistory: `[${new Date().toISOString()}] Plantilla enviada`,
          timeoutMinutes: rootChatbotMessage.timeToWaitInMinutes || 5,
          startedAt: new Date()
        });

        console.log(`[SendInactivityBotMessageMeta] ProactiveBotSession creada: ${session.id}`);

        result.success++;
        console.log(`[SendInactivityBotMessageMeta] ✓ Enviado exitosamente a ${number}`);

        // 6.7. Rate limiting: delay entre mensajes (excepto el último)
        if (i < numbers.length - 1) {
          console.log(`[SendInactivityBotMessageMeta] Esperando ${delayBetweenMessages}ms antes del siguiente envío...`);
          await delay(delayBetweenMessages);
        }

      } catch (error: any) {
        console.error(`[SendInactivityBotMessageMeta] Error procesando ${number}:`, error);
        result.failed++;
        result.errors.push({
          number,
          error: error.message || 'Error desconocido'
        });
        Sentry.captureException(error);
      }
    }

    console.log(`[SendInactivityBotMessageMeta] Proceso finalizado. Exitosos: ${result.success}, Fallidos: ${result.failed}`);

  } catch (error: any) {
    console.error(`[SendInactivityBotMessageMeta] Error crítico:`, error);
    Sentry.captureException(error);
    throw error;
  }

  return result;
};

export default SendInactivityBotMessageMeta;
