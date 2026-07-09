import formatBody from "../../helpers/Mustache";
import { getWbot, applyPatchesToWbot } from "../../libs/wbot";
import Whatsapp from "../../models/Whatsapp";
import WhatsappCountry from "../../models/WhatsappCountry";
import { getCountryIdOfNumber } from "../ContactServices/CreateOrUpdateContactService";
import CheckIsValidContact from "./CheckIsValidContact";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import { verifyContact, verifyMessage } from "./wbotMessageListener";
import SendMessageRequest from "../../models/SendMessageRequest";

interface Request {
  toNumber: string;
  message: string;
  fromNumber?: string;
  userId?: number;
  queueId?: number;
}

interface ServiceResponse {
  success: boolean;
  data?: {
    sendMessageRequestId: number;
    status: string;
    fromNumber: string;
    toNumber: string;
    queuePosition: number;
  };
  error?: string;
  message?: string;
}

interface QueuedMessageWithTicket {
  fromNumber: string;
  toNumber: string;
  message: string;
  sendMessageRequest: SendMessageRequest;
  userId?: number;
  queueId?: number;
  createTicket: boolean;
}

interface QueueConfig {
  delayBetweenMessages: number;
}

// Estado global de la cola (similar a sendMessageV2)
const queueState = {
  queue: [] as QueuedMessageWithTicket[],
  processing: false,
  lastSentTimestamp: 0,
  config: {
    delayBetweenMessages: 45000 // 45 segundos entre cada mensaje
  } as QueueConfig
};

const ELIGIBLE_CONNECTION_STATES = ["CONNECTED", "PAIRING"];

const normalizePhoneNumber = (phoneNumber: string): string => {
  return phoneNumber.replace(/\D/g, "").trim();
};

const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Función para procesar la cola
const processQueue = async () => {
  if (queueState.processing) return;
  queueState.processing = true;

  while (queueState.queue.length > 0) {
    const now = Date.now();
    const timeSinceLastSent = now - queueState.lastSentTimestamp;
    const requiredDelay = queueState.config.delayBetweenMessages;

    // Respetar delay entre mensajes (45 segundos)
    if (queueState.lastSentTimestamp > 0 && timeSinceLastSent < requiredDelay) {
      await delay(requiredDelay - timeSinceLastSent);
    }

    const queuedMessage = queueState.queue.shift();
    if (!queuedMessage) continue;

    try {
      console.log("=".repeat(80));
      console.log("[SendMessageToContactService-Queue] 🔄 Procesando mensaje de la cola");
      console.log("[SendMessageToContactService-Queue] fromNumber:", queuedMessage.fromNumber);
      console.log("[SendMessageToContactService-Queue] toNumber:", queuedMessage.toNumber);
      console.log("=".repeat(80));

      // 1. Buscar WhatsApp por número
      const whatsapp = await Whatsapp.findOne({
        where: {
          number: queuedMessage.fromNumber,
          status: ELIGIBLE_CONNECTION_STATES
        }
      });

      if (!whatsapp) {
        console.log("[SendMessageToContactService-Queue] ❌ WhatsApp no disponible");
        queuedMessage.sendMessageRequest.status = "failed";
        await queuedMessage.sendMessageRequest.save();
        continue;
      }

      // 2. Validar contacto
      await CheckIsValidContact(queuedMessage.toNumber, whatsapp.id);

      // 3. Obtener wbot
      const wbot = getWbot(whatsapp.id);

      // Verificar que la sesión esté inicializada
      if (!(wbot as any)?.info) {
        console.log("[SendMessageToContactService-Queue] ❌ Sesión no inicializada");
        queuedMessage.sendMessageRequest.status = "failed";
        await queuedMessage.sendMessageRequest.save();
        continue;
      }

      // Verificar estado de conexión
      try {
        const wbotState = await wbot.getState();
        const validStates = ["CONNECTED", "PAIRING", "OPENING"];

        if (!validStates.includes(wbotState)) {
          console.log("[SendMessageToContactService-Queue] ❌ Estado inválido:", wbotState);
          queuedMessage.sendMessageRequest.status = "failed";
          await queuedMessage.sendMessageRequest.save();
          continue;
        }
      } catch (stateErr) {
        console.log("[SendMessageToContactService-Queue] ⚠️ No se pudo verificar estado");
      }

      // Aplicar parches si es necesario
      if ((wbot as any)?.pupPage) {
        try {
          await applyPatchesToWbot(wbot as any);
        } catch (patchErr) {
          console.log("[SendMessageToContactService-Queue] ⚠️ Error aplicando parches");
        }
      }

      // 4. Obtener ID correcto del destinatario (soporta @c.us antiguo y @lid nuevo)
      console.log(`[SendMessageToContactService-Queue] 🔍 Obteniendo ID correcto para: ${queuedMessage.toNumber}`);
      
      let destinationId: string;
      try {
        const numberId = await wbot.getNumberId(`${queuedMessage.toNumber}@c.us`);
        
        if (numberId) {
          // Usar el ID obtenido (puede ser @c.us o @lid)
          destinationId = numberId._serialized;
          console.log(`[SendMessageToContactService-Queue] ✅ ID obtenido con getNumberId: ${destinationId}`);
        } else {
          // Fallback: usar formato tradicional @c.us para números antiguos
          destinationId = `${queuedMessage.toNumber}@c.us`;
          console.log(`[SendMessageToContactService-Queue] ⚠️ getNumberId retornó null, usando formato tradicional: ${destinationId}`);
        }
      } catch (error: any) {
        // Si getNumberId falla, usar formato tradicional como fallback
        destinationId = `${queuedMessage.toNumber}@c.us`;
        console.log(`[SendMessageToContactService-Queue] ⚠️ Error en getNumberId, usando formato tradicional: ${destinationId}`);
        console.log(`[SendMessageToContactService-Queue] Error detalle:`, error?.message || error);
      }

      // 5. Enviar mensaje
      const body = formatBody(`\u200e${queuedMessage.message}`);
      const msg = await wbot.sendMessage(destinationId, body);
      console.log("[SendMessageToContactService-Queue] ✅ Mensaje enviado");

      // 6. Si createTicket es true, crear/encontrar ticket
      if (queuedMessage.createTicket) {
        const msgContact = await wbot.getContactById(msg.to);
        const contact = await verifyContact(msgContact);

        const ticket = await FindOrCreateTicketService({
          contact,
          whatsappId: whatsapp.id,
          unreadMessages: 0,
          groupContact: null,
          lastMessageTimestamp: msg.timestamp,
          msgFromMe: msg.fromMe,
          ...(queuedMessage.userId && { userId: queuedMessage.userId }),
          ...(queuedMessage.queueId && { queueId: queuedMessage.queueId })
        });

        await verifyMessage({
          msg,
          ticket,
          contact
        });

        console.log("[SendMessageToContactService-Queue] ✅ Ticket creado/actualizado:", ticket.id);
      }

      queuedMessage.sendMessageRequest.status = "sent";
      queueState.lastSentTimestamp = Date.now();

    } catch (error) {
      console.log("[SendMessageToContactService-Queue] ❌ Error:", error.message);
      queuedMessage.sendMessageRequest.status = "failed";
    }

    await queuedMessage.sendMessageRequest.save();
  }

  queueState.processing = false;
};

const SendMessageToContactService = async ({
  toNumber,
  message,
  fromNumber,
  userId,
  queueId
}: Request): Promise<ServiceResponse> => {
  try {
    console.log("=".repeat(80));
    console.log("[SendMessageToContactService] 📞 Agregando mensaje a la cola");
    console.log("[SendMessageToContactService] toNumber:", toNumber);
    console.log("[SendMessageToContactService] fromNumber:", fromNumber || "auto");
    console.log("=".repeat(80));

    // 1. Normalizar número destino
    const normalizedToNumber = normalizePhoneNumber(toNumber);

    // 2. Normalizar fromNumber si existe
    let normalizedFromNumber: string | undefined;
    if (fromNumber) {
      normalizedFromNumber = normalizePhoneNumber(fromNumber);
      console.log("[SendMessageToContactService] fromNumber proporcionado:", normalizedFromNumber);
    }

    // 3. Buscar WhatsApp disponible
    let whatsapp: Whatsapp | null = null;

    if (normalizedFromNumber) {
      // Si se proporciona fromNumber, buscar ese específico
      whatsapp = await Whatsapp.findOne({
        where: {
          number: normalizedFromNumber,
          status: ELIGIBLE_CONNECTION_STATES
        }
      });

      if (!whatsapp) {
        console.log("[SendMessageToContactService] ❌ WhatsApp con número", normalizedFromNumber, "no encontrado o no disponible");
        return {
          success: false,
          error: "WHATSAPP_NOT_AVAILABLE",
          message: `WhatsApp con número ${normalizedFromNumber} no está disponible`
        };
      }
    } else {
      // Si no se proporciona fromNumber, buscar el primero disponible
      whatsapp = await Whatsapp.findOne({
        where: {
          status: ELIGIBLE_CONNECTION_STATES
        },
        order: [["id", "ASC"]]
      });

      if (!whatsapp) {
        console.log("[SendMessageToContactService] ❌ No hay WhatsApps disponibles");
        return {
          success: false,
          error: "NO_WHATSAPP_AVAILABLE",
          message: "No hay WhatsApps disponibles"
        };
      }
    }

    const selectedFromNumber = normalizePhoneNumber(whatsapp.number);
    console.log("[SendMessageToContactService] ✅ WhatsApp seleccionado:", selectedFromNumber, "-", whatsapp.name);

    // 3. Crear registro en BD
    const sendMessageRequest = await SendMessageRequest.create({
      fromNumber: selectedFromNumber,
      toNumber: normalizedToNumber,
      message,
      status: "pending"
    });

    // 4. Agregar a la cola
    queueState.queue.push({
      fromNumber: selectedFromNumber,
      toNumber: normalizedToNumber,
      message,
      sendMessageRequest,
      userId,
      queueId,
      createTicket: true
    });

    const queuePosition = queueState.queue.length;
    console.log("[SendMessageToContactService] 📨 Mensaje agregado a la cola. Posición:", queuePosition);

    // 5. Iniciar procesamiento si no está en curso
    if (!queueState.processing) {
      processQueue();
    }

    return {
      success: true,
      data: {
        sendMessageRequestId: sendMessageRequest.id,
        status: "pending",
        fromNumber: selectedFromNumber,
        toNumber: normalizedToNumber,
        queuePosition
      }
    };

  } catch (error) {
    console.log("=".repeat(80));
    console.log("[SendMessageToContactService] ❌ ERROR:");
    console.log("[SendMessageToContactService] Error:", error.message);
    console.log("=".repeat(80));

    return {
      success: false,
      error: "QUEUE_ERROR",
      message: `Error al agregar mensaje a la cola: ${error.message}`
    };
  }
};

export default SendMessageToContactService;
