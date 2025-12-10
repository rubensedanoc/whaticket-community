import { MessageContent, MessageMedia } from "whatsapp-web.js";
import SendExternalWhatsAppMessage from "./SendExternalWhatsAppMessage";
import SendMessageRequest from "../../models/SendMessageRequest";
import { getWbot } from "../../libs/wbot";
import Whatsapp from "../../models/Whatsapp";

interface QueuedMessage {
  fromNumber: string;                       // numero de WhatsApp desde donde se envía
  toNumber: string;                         // numero de WhatsApp destino
  message: string;                          // Texto del mensaje
  sendMessageRequest: SendMessageRequest;   // Registro en BD para tracking
  mediaUrl?: string | null;                 // URL de archivo multimedia (opcional)
}

interface QueueConfig {
  delayBetweenMessages: number;  // tiempo de espera entre mensajes (en milisegundos)
}

// ESTADO GLOBAL DE LA COLA (compartido por todas las peticiones)
const queueState = {
  queue: [] as QueuedMessage[],   // Array que almacena todos los mensajes pendientes
  processing: false,               // Flag para saber si ya hay un proceso activo
  config: {
    delayBetweenMessages: 15000     // 15 segundos de espera entre cada mensaje
  } as QueueConfig
};

// Crea una pausa/espera de X milisegundos
const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Esta funcuon se ejecuta en segundo plano y procesa los mensajes UNO POR UNO
const processQueue = async () => {
  // BLOQUEO: Si ya hay un proceso ejecutándose, no inicia otro
  if (queueState.processing) return;

  // Marca que el proceso está activo
  queueState.processing = true;

  // LOOP: Procesa todos los mensajes en la cola uno tras otro
  while (queueState.queue.length > 0) {
    // Extrae el PRIMER mensaje de la cola (FIFO - First In, First Out)
    const message = queueState.queue.shift();

    try {
      // 1. Busca la conexión de WhatsApp en la base de datos
      const fromWpp = await Whatsapp.findOne({
        where: {
          number: message.fromNumber
        }
      });

      // 2. Obtiene el bot/cliente de WhatsApp activo
      const wbot = getWbot(fromWpp.id);

      // 3. Verifica si el mensaje tiene archivo multimedia
      if (message.mediaUrl) {
        // Descarga el archivo multimedia desde la URL
        const media = await MessageMedia.fromUrl(message.mediaUrl);
        // Envía el mensaje con el archivo adjunto
        await wbot.sendMessage(`${message.toNumber}@c.us`, media, {
          caption: message.message  // El texto va como caption/descripción
        });
      } else {
        // Envía solo el mensaje de texto
        await wbot.sendMessage(`${message.toNumber}@c.us`, message.message);
      }

      // Marca el mensaje como enviado exitosamente
      message.sendMessageRequest.status = 'sent';
    } catch (error) {
      // Si hay error, lo registra en consola
      console.log('Error sending message from queue:', error);
      // Marca el mensaje como fallido
      message.sendMessageRequest.status = 'failed';
    }

    // Guarda el estado del mensaje en la base de datos
    await message.sendMessageRequest.save();

    // Si aun quedan mensajes en la cola, espera 8 segundos antes del siguiente
    if (queueState.queue.length > 0) {
      await delay(queueState.config.delayBetweenMessages);
    }
  }

  // Libera el proceso (permite que se pueda iniciar de nuevo si llegan mas mensajes)
  queueState.processing = false;
};
// Esta es la funcion que se llama desde la API REST para encolar un mensaje
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

  // VALIDACION 1: Verifica que vengan todos los datos requeridos
  if (!fromNumber || !toNumber || !message) {
    mensajes.push('Faltan datos necesarios para enviar el mensaje');
  }

  // VALIDACION 2: Verifica que los números sean válidos (solo dígitos)
  if (isNaN(Number(fromNumber.replace(/\D/g, ''))) || isNaN(Number(toNumber.replace(/\D/g, '')))) {
    mensajes.push('Números de teléfono inválidos');
  }

  // Si pasó las validaciones, procede a encolar el mensaje
  if (!mensajes.length) {

    // Limpia los números (elimina caracteres no numéricos)
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
