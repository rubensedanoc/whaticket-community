import { MessageMedia } from "whatsapp-web.js";
import SendMessageRequest from "../../models/SendMessageRequest";
import { getWbot, applyPatchesToWbot } from "../../libs/wbot";
import Whatsapp from "../../models/Whatsapp";

interface QueuedMessage {
  fromNumber: string;
  toNumber: string;
  message: string;
  sendMessageRequest: SendMessageRequest;
  mediaUrl?: string | null;
  selectionMode: "round-robin";
}

interface QueueConfig {
  delayBetweenMessages: number;
}

// Estado global de la cola
const queueState = {
  queue: [] as QueuedMessage[],
  processing: false,
  lastSentTimestamp: 0,
  config: {
    delayBetweenMessages: 45000 // 45 segundos entre cada mensaje
  } as QueueConfig
};

const ELIGIBLE_CONNECTION_STATES = ["CONNECTED", "PAIRING"];

// Estado de alternancia global
const alternationState = {
  currentIndex: 0
};

const normalizePhoneNumber = (phoneNumber: string): string => {
  return phoneNumber.replace(/\D/g, "").trim();
};

const getInitializedConnectionByNumber = async (
  fromNumber: string
): Promise<Whatsapp | null> => {
  const normalizedFromNumber = normalizePhoneNumber(fromNumber);

  const connection = await Whatsapp.findOne({
    where: {
      number: normalizedFromNumber,
      status: ELIGIBLE_CONNECTION_STATES
    },
    order: [["id", "DESC"]]
  });

  if (!connection) {
    console.log(
      `[wbot-queue] ⚠️ Conexión ${normalizedFromNumber} descartada: no está en ${ELIGIBLE_CONNECTION_STATES.join(", ")}`
    );
    return null;
  }

  const wbot = getWbot(connection.id);
  if (!(wbot as any)?.info) {
    console.log(
      `[wbot-queue] ⚠️ Conexión ${normalizedFromNumber} descartada: sesión no inicializada`
    );
    return null;
  }

  return connection;
};

const getEligibleConnections = async (): Promise<Whatsapp[]> => {
  const activeConnections = await Whatsapp.findAll({
    where: {
      status: ELIGIBLE_CONNECTION_STATES
    },
    order: [["id", "ASC"]]
  });

  const eligibleConnections: Whatsapp[] = [];

  for (const connection of activeConnections) {
    const validatedConnection = await getInitializedConnectionByNumber(
      connection.number
    );

    if (validatedConnection) {
      eligibleConnections.push(validatedConnection);
    }
  }

  return eligibleConnections;
};

const getNextConnection = (connections: Whatsapp[]): Whatsapp => {
  const nextIndex = alternationState.currentIndex % connections.length;
  const selectedConnection = connections[nextIndex];

  alternationState.currentIndex = (nextIndex + 1) % connections.length;

  return selectedConnection;
};

const getFallbackConnection = async (
  excludedFromNumber?: string
): Promise<Whatsapp | null> => {
  const eligibleConnections = await getEligibleConnections();

  const fallbackConnection = eligibleConnections.find(connection => {
    if (!excludedFromNumber) {
      return true;
    }

    return normalizePhoneNumber(connection.number) !== excludedFromNumber;
  });

  return fallbackConnection || null;
};

const resolveOutgoingConnection = async ({
  fromNumber
}: {
  fromNumber?: string;
}): Promise<{
  selectedFromNumber: string | null;
  selectionMode: "round-robin";
}> => {
  if (fromNumber) {
    console.log(
      `[wbot-queue] ℹ️ fromNumber ${normalizePhoneNumber(fromNumber)} recibido, pero este flujo usa alternancia automática.`
    );
  }

  const eligibleConnections = await getEligibleConnections();
  if (!eligibleConnections.length) {
    console.log("[wbot-queue] ❌ No hay conexiones elegibles para alternancia");
    return {
      selectedFromNumber: null,
      selectionMode: "round-robin"
    };
  }

  const selectedConnection = getNextConnection(eligibleConnections);
  const normalizedFromNumber = normalizePhoneNumber(selectedConnection.number);

  console.log(
    `[wbot-queue] 🔄 Conexión seleccionada por alternancia: ${normalizedFromNumber} (siguiente índice: ${alternationState.currentIndex})`
  );

  return {
    selectedFromNumber: normalizedFromNumber,
    selectionMode: "round-robin"
  };
};

const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

const processQueue = async () => {
  if (queueState.processing) return;
  queueState.processing = true;

  while (queueState.queue.length > 0) {
    const now = Date.now();
    const timeSinceLastSent = now - queueState.lastSentTimestamp;
    const requiredDelay = queueState.config.delayBetweenMessages;

    // Respetar delay entre mensajes
    if (queueState.lastSentTimestamp > 0 && timeSinceLastSent < requiredDelay) {
      await delay(requiredDelay - timeSinceLastSent);
    }

    const message = queueState.queue.shift();
    if (!message) continue;

    try {
      console.log(
        `[wbot-queue] 🔍 Validando conexión ${message.fromNumber} para ${message.toNumber} (${message.selectionMode})`
      );

      const fromWpp = await getInitializedConnectionByNumber(message.fromNumber);

      if (!fromWpp) {
        const fallbackConnection = await getFallbackConnection(message.fromNumber);

        if (fallbackConnection) {
          const fallbackFromNumber = normalizePhoneNumber(fallbackConnection.number);

          console.warn(
            `[wbot-queue] 🔁 La conexión ${message.fromNumber} no está disponible para ${message.toNumber}. Se usará fallback ${fallbackFromNumber}.`
          );

          message.fromNumber = fallbackFromNumber;

          queueState.queue.unshift(message);
          continue;
        }

        console.error(
          `[wbot-queue] ❌ La conexión ${message.fromNumber} ya no está disponible para ${message.toNumber} y no hay fallback elegible.`
        );

        const allConnections = await Whatsapp.findAll({
          attributes: ["id", "name", "number", "status"]
        });
        console.error(
          "[wbot-queue] 📋 Conexiones disponibles en DB:",
          JSON.stringify(allConnections, null, 2)
        );

        message.sendMessageRequest.status = "failed";
        await message.sendMessageRequest.save();
        continue;
      }

      const wbot = getWbot(fromWpp.id);

      // Verificar que la sesión esté completamente inicializada
      if (!(wbot as any)?.info) {
        console.error(`[wbot-queue] ❌ Sesión de WhatsApp ID ${fromWpp.id} no está completamente inicializada (falta info)`);
        message.sendMessageRequest.status = 'failed';
        await message.sendMessageRequest.save();
        continue;
      }

      // Verificar estado de conexión
      try {
        const wbotState = await wbot.getState();
        const validStates = ["CONNECTED", "PAIRING", "OPENING"];

        if (!validStates.includes(wbotState)) {
          console.error(`[wbot-queue] ❌ WhatsApp ${fromWpp.id} en estado inválido: ${wbotState}. Estados válidos: ${validStates.join(', ')}`);
          message.sendMessageRequest.status = 'failed';
          await message.sendMessageRequest.save();
          continue;
        }
        
        console.log(`[wbot-queue] ✓ Estado válido: ${wbotState}`);
      } catch (stateErr) {
        console.warn(`[wbot-queue] ⚠️ No se pudo verificar estado para WhatsApp ${fromWpp.id}:`, stateErr.message);
        // Continuar con precaución
      }

      // Aplicar parches si es necesario (NO BLOQUEAR si falla)
      if ((wbot as any)?.pupPage) {
        try {
          const patched = await applyPatchesToWbot(wbot as any);
          if (!patched) {
            console.warn('[wbot-queue] ⚠️ No se pudieron aplicar parches, continuando sin ellos...');
          }
        } catch (error) {
          console.warn('[wbot-queue] ⚠️ Error aplicando parches, continuando sin ellos:', error);
        }
      }

      // Obtener el ID correcto del destinatario (soporta @c.us antiguo y @lid nuevo)
      console.log(`[wbot-queue] 🔍 Obteniendo ID correcto para: ${message.toNumber}`);
      
      let destinationId: string;
      try {
        const numberId = await wbot.getNumberId(`${message.toNumber}@c.us`);
        
        if (numberId) {
          // Usar el ID obtenido (puede ser @c.us o @lid)
          destinationId = numberId._serialized;
          console.log(`[wbot-queue] ✅ ID obtenido con getNumberId: ${destinationId}`);
        } else {
          // Fallback: usar formato tradicional @c.us para números antiguos
          destinationId = `${message.toNumber}@c.us`;
          console.log(`[wbot-queue] ⚠️ getNumberId retornó null, usando formato tradicional: ${destinationId}`);
        }
      } catch (error: any) {
        // Si getNumberId falla, usar formato tradicional como fallback
        destinationId = `${message.toNumber}@c.us`;
        console.log(`[wbot-queue] ⚠️ Error en getNumberId, usando formato tradicional: ${destinationId}`);
        console.log(`[wbot-queue] Error detalle:`, error?.message || error);
      }

      // Enviar mensaje usando el ID correcto
      if (message.mediaUrl) {
        const media = await MessageMedia.fromUrl(message.mediaUrl);
        await wbot.sendMessage(destinationId, media, {
          caption: message.message
        });
      } else {
        await wbot.sendMessage(destinationId, message.message);
      }

      message.sendMessageRequest.status = 'sent';
      queueState.lastSentTimestamp = Date.now();

    } catch (error: any) {
      console.error('[wbot-queue] Error enviando mensaje:', error?.message || error);
      message.sendMessageRequest.status = 'failed';
    }

    await message.sendMessageRequest.save();
  }

  queueState.processing = false;
};

export const addMessageToQueue = async ({
  fromNumber,
  toNumber,
  message,
  mediaUrl = null
}: {
  fromNumber?: string;
  toNumber: string;
  message: string;
  mediaUrl?: string | null;
}) => {
  const mensajes: string[] = [];
  let data = null;

  // Validaciones
  if (!toNumber || !message) {
    mensajes.push('Faltan datos necesarios para enviar el mensaje (toNumber y message son requeridos)');
    return { mensajes, data };
  }

  // Validar que toNumber sea string antes de usar replace
  if (typeof toNumber !== 'string') {
    mensajes.push('El número de destino debe ser un string válido');
    return { mensajes, data };
  }

  // Normalizar fromNumber: tratar string vacío como undefined
  if (fromNumber === '') {
    fromNumber = undefined;
  }

  // Validar formato de números
  if (isNaN(Number(toNumber.replace(/\D/g, '')))) {
    mensajes.push('Número de teléfono de destino inválido');
    return { mensajes, data };
  }

  if (fromNumber && typeof fromNumber !== 'string') {
    console.warn('[wbot-queue] ⚠️ fromNumber recibido con tipo inválido; será ignorado por alternancia automática.');
    fromNumber = undefined;
  } else if (fromNumber && isNaN(Number(fromNumber.replace(/\D/g, '')))) {
    console.warn('[wbot-queue] ⚠️ fromNumber recibido con formato inválido; será ignorado por alternancia automática.');
    fromNumber = undefined;
  }

  if (!mensajes.length) {
    // Limpiar números
    toNumber = normalizePhoneNumber(toNumber);
    fromNumber = fromNumber ? normalizePhoneNumber(fromNumber) : undefined;

    const resolvedConnection = await resolveOutgoingConnection({
      fromNumber
    });

    if (!resolvedConnection.selectedFromNumber) {
      mensajes.push('No hay conexiones elegibles disponibles para este envío');
      return { mensajes, data };
    }

    fromNumber = resolvedConnection.selectedFromNumber;

    const sendMessageRequest = await SendMessageRequest.create({
      fromNumber,
      toNumber,
      message,
    });

    queueState.queue.push({
      fromNumber,
      toNumber,
      message,
      mediaUrl,
      sendMessageRequest,
      selectionMode: resolvedConnection.selectionMode
    });
    console.log(`[wbot-queue] 📨 Mensaje agregado a la cola. Total en cola: ${queueState.queue.length}`);

    if (!queueState.processing) {
      processQueue();
    }

    data = { sendMessageRequest };
  }

  return { mensajes, data };
};
