import SendMessageRequest from "../../models/SendMessageRequest";
import Whatsapp from "../../models/Whatsapp";
import { MetaApiClient } from "../../clients/MetaApiClient";
import path from "path";
import fs from "fs";
import axios from "axios";

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

// Estado global de la cola Meta
const queueStateMeta = {
  queue: [] as QueuedMessage[],
  processing: false,
  lastSentTimestamp: 0,
  config: {
    delayBetweenMessages: 20000 // 20 segundos entre cada mensaje
  } as QueueConfig
};

const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

const processQueueMeta = async () => {
  if (queueStateMeta.processing) return;
  queueStateMeta.processing = true;

  while (queueStateMeta.queue.length > 0) {
    const now = Date.now();
    const timeSinceLastSent = now - queueStateMeta.lastSentTimestamp;
    const requiredDelay = queueStateMeta.config.delayBetweenMessages;

    // Respetar delay entre mensajes
    if (queueStateMeta.lastSentTimestamp > 0 && timeSinceLastSent < requiredDelay) {
      await delay(requiredDelay - timeSinceLastSent);
    }

    const message = queueStateMeta.queue.shift();
    if (!message) continue;

    try {
      // Buscar conexión activa
      const fromWpp = await Whatsapp.findOne({
        where: {
          number: message.fromNumber,
          status: "CONNECTED"
        },
        order: [['id', 'DESC']]
      });

      if (!fromWpp) {
        console.error('[meta-queue] No se encontró conexión activa para:', message.fromNumber);
        message.sendMessageRequest.status = 'failed';
        await message.sendMessageRequest.save();
        continue;
      }

      // Validar credenciales Meta API
      if (!fromWpp.phoneNumberId || !fromWpp.metaAccessToken) {
        console.error('[meta-queue] Credenciales Meta no configuradas para:', message.fromNumber);
        message.sendMessageRequest.status = 'failed';
        await message.sendMessageRequest.save();
        continue;
      }

      // Crear cliente Meta API
      const client = new MetaApiClient({
        phoneNumberId: fromWpp.phoneNumberId,
        accessToken: fromWpp.metaAccessToken
      });

      // Enviar mensaje
      if (message.mediaUrl) {
        // Determinar si es URL externa o archivo local
        const isExternalUrl = message.mediaUrl.startsWith('http://') || message.mediaUrl.startsWith('https://');
        
        let mediaPath: string;
        let isTemporaryFile = false;

        if (isExternalUrl) {
          // Descargar URL externa temporalmente
          console.log('[meta-queue] Media externa detectada, descargando:', message.mediaUrl);
          
          try {
            const response = await axios.get(message.mediaUrl, { responseType: 'arraybuffer' });
            const ext = path.extname(new URL(message.mediaUrl).pathname) || '.jpg';
            const tempFilename = `temp-${Date.now()}${ext}`;
            mediaPath = path.join(process.cwd(), 'public', tempFilename);
            
            fs.writeFileSync(mediaPath, response.data);
            isTemporaryFile = true;
            console.log('[meta-queue] Media descargada temporalmente:', tempFilename);
          } catch (error) {
            console.error('[meta-queue] Error descargando media externa:', error);
            // Si falla descarga, enviar solo texto
            await client.sendText({
              to: message.toNumber,
              body: message.message
            });
            message.sendMessageRequest.status = 'sent';
            queueStateMeta.lastSentTimestamp = Date.now();
            await message.sendMessageRequest.save();
            continue;
          }
        } else {
          // Es archivo local en /public
          mediaPath = path.join(process.cwd(), 'public', message.mediaUrl);
        }

        // Determinar tipo de media por extensión
        const ext = path.extname(mediaPath).toLowerCase();
        let mediaType: 'image' | 'audio' | 'document' = 'document';

        if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
          mediaType = 'image';
        } else if (['.mp3', '.ogg', '.wav', '.aac', '.m4a'].includes(ext)) {
          mediaType = 'audio';
        }

        // Subir y enviar media
        try {
          if (mediaType === 'image') {
            const uploadResult = await client.uploadMedia(mediaPath, 'image/jpeg');
            await client.sendImage({
              to: message.toNumber,
              mediaId: uploadResult.id,
              caption: message.message || undefined
            });
          } else if (mediaType === 'audio') {
            const uploadResult = await client.uploadMedia(mediaPath, 'audio/ogg');
            await client.sendAudio({
              to: message.toNumber,
              mediaId: uploadResult.id
            });
          } else {
            const uploadResult = await client.uploadMedia(mediaPath, 'application/pdf');
            const filename = path.basename(mediaPath);
            await client.sendDocument({
              to: message.toNumber,
              mediaId: uploadResult.id,
              filename,
              caption: message.message || undefined
            });
          }

          // Eliminar archivo temporal si fue descargado
          if (isTemporaryFile && fs.existsSync(mediaPath)) {
            fs.unlinkSync(mediaPath);
            console.log('[meta-queue] Archivo temporal eliminado:', mediaPath);
          }
        } catch (uploadError) {
          console.error('[meta-queue] Error subiendo media:', uploadError);
          
          // Eliminar archivo temporal si existe
          if (isTemporaryFile && fs.existsSync(mediaPath)) {
            fs.unlinkSync(mediaPath);
          }
          
          throw uploadError;
        }
      } else {
        // Solo texto
        await client.sendText({
          to: message.toNumber,
          body: message.message
        });
      }

      message.sendMessageRequest.status = 'sent';
      queueStateMeta.lastSentTimestamp = Date.now();

    } catch (error: any) {
      console.error('[meta-queue] Error enviando mensaje:', error?.message || error);
      message.sendMessageRequest.status = 'failed';
    }

    await message.sendMessageRequest.save();
  }

  queueStateMeta.processing = false;
};

export const addMessageToQueueMeta = async ({
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
    fromNumber = fromNumber.replace(/\D/g, '').trim();
    toNumber = toNumber.replace(/\D/g, '').trim();

    const sendMessageRequest = await SendMessageRequest.create({
      fromNumber,
      toNumber,
      message,
    });

    queueStateMeta.queue.push({ 
      fromNumber, 
      toNumber, 
      message, 
      mediaUrl, 
      sendMessageRequest
    });

    if (!queueStateMeta.processing) {
      processQueueMeta();
    }

    data = { sendMessageRequest };
  }

  return { mensajes, data };
};
