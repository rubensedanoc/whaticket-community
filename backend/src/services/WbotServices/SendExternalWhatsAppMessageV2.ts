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
      
      // Buscar conexión activa (CONNECTED o PAIRING)
      const fromWpp = await Whatsapp.findOne({
        where: {
          number: message.fromNumber,
          status: ["CONNECTED", "PAIRING"]
        },
        order: [['id', 'DESC']]
      });

      if (!fromWpp) {
        console.error(`[wbot-queue] ❌ No se encontró conexión activa para: ${message.fromNumber}`);
        
        // Debug: mostrar todas las conexiones disponibles
        const allConnections = await Whatsapp.findAll({
          attributes: ['id', 'name', 'number', 'status']
        });
        console.error('[wbot-queue] 📋 Conexiones disponibles en DB:', JSON.stringify(allConnections, null, 2));
        
        message.sendMessageRequest.status = 'failed';
        await message.sendMessageRequest.save();
        continue;
      }
      
      console.log(`[wbot-queue] ✅ Conexión encontrada - ID: ${fromWpp.id}, Nombre: ${fromWpp.name}, Estado: ${fromWpp.status}`);

      const wbot = getWbot(fromWpp.id);

      // Aplicar parches si es necesario
      if ((wbot as any)?.pupPage) {
        const patched = await applyPatchesToWbot(wbot as any);
        if (!patched) {
          console.error('[wbot-queue] Falló aplicación de parches para whatsappId:', fromWpp.id);
          message.sendMessageRequest.status = 'failed';
          await message.sendMessageRequest.save();
          continue;
        }
      }

      // Enviar mensaje
      if (message.mediaUrl) {
        const media = await MessageMedia.fromUrl(message.mediaUrl);
        await wbot.sendMessage(`${message.toNumber}@c.us`, media, {
          caption: message.message
        });
      } else {
        await wbot.sendMessage(`${message.toNumber}@c.us`, message.message);
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
  fromNumber: string;
  toNumber: string;
  message: string;
  mediaUrl?: string | null;
}) => {
  const mensajes: string[] = [];
  let data = null;

  // Validaciones
  if (!fromNumber || !toNumber || !message) {
    mensajes.push('Faltan datos necesarios para enviar el mensaje');
  }

  if (isNaN(Number(fromNumber.replace(/\D/g, ''))) || isNaN(Number(toNumber.replace(/\D/g, '')))) {
    mensajes.push('Números de teléfono inválidos');
  }

  if (!mensajes.length) {
    // Limpiar números
    toNumber = toNumber.replace(/\D/g, '').trim();
    
    // Usar número alternado en vez del fromNumber que viene del PHP
    const originalFromNumber = fromNumber;
    fromNumber = getNextNumber();
    
    console.log(`[wbot-queue] 🔄 Alternancia: ${originalFromNumber} → ${fromNumber} (índice actual: ${alternationState.currentIndex})`);

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
