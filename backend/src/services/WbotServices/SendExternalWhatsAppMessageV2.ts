import { MessageContent, MessageMedia } from "whatsapp-web.js";
import SendExternalWhatsAppMessage from "./SendExternalWhatsAppMessage";
import SendMessageRequest from "../../models/SendMessageRequest";
import { getWbot } from "../../libs/wbot";
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

// Estado de la cola
const queueState = {
  queue: [] as QueuedMessage[],
  processing: false,
  config: {
    delayBetweenMessages: 3000,
  } as QueueConfig
};

// Helper para delay
const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Procesar la cola
const processQueue = async () => {
  if (queueState.processing) return;

  queueState.processing = true;

  while (queueState.queue.length > 0) {
    const message = queueState.queue.shift();

    try {

      const fromWpp = await Whatsapp.findOne({
        where: {
          number: message.fromNumber
        }
      });

      const wbot = getWbot(fromWpp.id);

      if (message.mediaUrl) {
        const media = await MessageMedia.fromUrl(message.mediaUrl);
        await wbot.sendMessage(`${message.toNumber}@c.us`, media, {
          caption: message.message
        });
      } else {
        await wbot.sendMessage(`${message.toNumber}@c.us`, message.message);
      }

      message.sendMessageRequest.status = 'sent';
    } catch (error) {
      message.sendMessageRequest.status = 'failed';
    }

    await message.sendMessageRequest.save();

    if (queueState.queue.length > 0) {
      await delay(queueState.config.delayBetweenMessages);
    }
  }

  queueState.processing = false;
};

// Agregar mensaje a la cola
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
  let data = null;
  let mensajes = [];

  if (!fromNumber || !toNumber || !message) {
    mensajes.push('Faltan datos necesarios para enviar el mensaje');
  }

  if (isNaN(Number(fromNumber.replace(/\D/g, ''))) || isNaN(Number(toNumber.replace(/\D/g, '')))) {
    mensajes.push('Números de teléfono inválidos');
  }

  if (!mensajes.length) {

    fromNumber = fromNumber.replace(/\D/g, '').trim();
    toNumber = toNumber.replace(/\D/g, '').trim();

    const sendMessageRequest = await SendMessageRequest.create({
      fromNumber,
      toNumber,
      message,
    });

    queueState.queue.push({ fromNumber, toNumber, message, mediaUrl, sendMessageRequest });

    if (!queueState.processing) {
      processQueue();
    }

    data = {
      sendMessageRequest
    };

  }

  return {
    mensajes,
    data
  };
};
