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
    delayBetweenMessages: 30000 // 30 segundos entre cada mensaje
  } as QueueConfig
};

// Estado de alternancia de números
const alternationState = {
  numbers: ['51985001690', '51985002996'], // <-- Configura aquí los números de WhatsApp conectados
  currentIndex: 0
};

// Función para obtener el siguiente número en alternancia
const getNextNumber = (): string => {
  const number = alternationState.numbers[alternationState.currentIndex];
  alternationState.currentIndex = (alternationState.currentIndex + 1) % alternationState.numbers.length;
  return number;
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
      console.log(`[wbot-queue] 🔍 Buscando conexión para número: ${message.fromNumber}`);
      
      // Buscar conexión activa (CONNECTED o PAIRING) para el número asignado
      let fromWpp = await Whatsapp.findOne({
        where: {
          number: message.fromNumber,
          status: ["CONNECTED", "PAIRING"]
        },
        order: [['id', 'DESC']]
      });

      // Verificar que la sesión wbot esté inicializada
      if (fromWpp) {
        const wbotTest = getWbot(fromWpp.id);
        if (!(wbotTest as any)?.info) {
          console.log(`[wbot-queue] ⚠️ Conexión ${fromWpp.number} (ID: ${fromWpp.id}) no tiene sesión inicializada`);
          fromWpp = null;
        } else {
          console.log(`[wbot-queue] ✅ Conexión encontrada - ID: ${fromWpp.id}, Nombre: ${fromWpp.name}, Estado: ${fromWpp.status}`);
        }
      }

      // FALLBACK: Si el número asignado no está disponible, buscar cualquier número activo con sesión inicializada
      if (!fromWpp) {
        console.log(`[wbot-queue] ⚠️ Número asignado ${message.fromNumber} no disponible, buscando fallback...`);
        
        const allActiveConnections = await Whatsapp.findAll({
          where: {
            status: ["CONNECTED", "PAIRING"]
          },
          order: [['id', 'DESC']]
        });
        
        // Buscar la primera conexión con sesión inicializada
        for (const conn of allActiveConnections) {
          const wbotTest = getWbot(conn.id);
          if ((wbotTest as any)?.info) {
            fromWpp = conn;
            console.log(`[wbot-queue] ✅ Usando fallback: ${fromWpp.number} (ID: ${fromWpp.id}, Nombre: ${fromWpp.name})`);
            break;
          } else {
            console.log(`[wbot-queue] ⏭️ Saltando conexión ${conn.number} (ID: ${conn.id}) - sesión no inicializada`);
          }
        }
      }

      // Si aún no hay ninguna conexión activa disponible, marcar como failed
      if (!fromWpp) {
        console.error(`[wbot-queue] ❌ No hay ninguna conexión activa disponible`);
        
        // Debug: mostrar todas las conexiones disponibles
        const allConnections = await Whatsapp.findAll({
          attributes: ['id', 'name', 'number', 'status']
        });
        console.error('[wbot-queue] 📋 Conexiones disponibles en DB:', JSON.stringify(allConnections, null, 2));
        
        message.sendMessageRequest.status = 'failed';
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
        const validStates = ['CONNECTED', 'PAIRING', 'OPENING'];

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

  // Validar fromNumber solo si se proporciona y no está vacío
  if (fromNumber && typeof fromNumber !== 'string') {
    mensajes.push('El número de origen debe ser un string válido');
    return { mensajes, data };
  }

  // Validar formato de números
  if (isNaN(Number(toNumber.replace(/\D/g, '')))) {
    mensajes.push('Número de teléfono de destino inválido');
    return { mensajes, data };
  }

  if (fromNumber && isNaN(Number(fromNumber.replace(/\D/g, '')))) {
    mensajes.push('Número de teléfono de origen inválido');
    return { mensajes, data };
  }

  if (!mensajes.length) {
    // Limpiar números
    toNumber = toNumber.replace(/\D/g, '').trim();
    
    // Si no se proporciona fromNumber o está vacío, usar el sistema de alternancia
    const originalFromNumber = fromNumber || 'auto';
    fromNumber = fromNumber ? fromNumber.replace(/\D/g, '').trim() : getNextNumber();
    
    if (originalFromNumber === 'auto') {
      console.log(`[wbot-queue] 🔄 Número seleccionado automáticamente: ${fromNumber} (índice actual: ${alternationState.currentIndex})`);
    } else {
      console.log(`[wbot-queue] 🔄 Alternancia: ${originalFromNumber} → ${fromNumber} (índice actual: ${alternationState.currentIndex})`);
    }

    const sendMessageRequest = await SendMessageRequest.create({
      fromNumber,
      toNumber,
      message,
    });

    queueState.queue.push({ fromNumber, toNumber, message, mediaUrl, sendMessageRequest });
    console.log(`[wbot-queue] 📨 Mensaje agregado a la cola. Total en cola: ${queueState.queue.length}`);

    if (!queueState.processing) {
      processQueue();
    }

    data = { sendMessageRequest };
  }

  return { mensajes, data };
};
