import { MessageMedia } from "whatsapp-web.js";
import SendMessageRequest from "../../models/SendMessageRequest";
import { getWbot, applyPatchesToWbot, hasActiveSession } from "../../libs/wbot";
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

// Estado de rotación dinámica
const rotationState = {
  lastUsedIndex: 0
};

// Obtener conexiones disponibles (DB + memoria)
const getAvailableConnections = async (): Promise<Whatsapp[]> => {
  // 1. Obtener todas las conexiones CONNECTED/PAIRING de DB
  const dbConnections = await Whatsapp.findAll({
    where: {
      status: ["CONNECTED", "PAIRING"],
      wasDeleted: false
    },
    order: [['id', 'ASC']]
  });

  console.log(`[wbot-queue] 📋 Conexiones en DB con estado CONNECTED/PAIRING:`, dbConnections.map(c => ({
    id: c.id,
    name: c.name,
    number: c.number || 'N/A',
    status: c.status
  })));

  // 2. Filtrar solo las que tienen sesión activa en memoria
  const validConnections = dbConnections.filter(conn => 
    hasActiveSession(conn.id)
  );

  console.log(`[wbot-queue] ✅ Conexiones válidas (DB + Memoria):`, validConnections.map(c => ({
    id: c.id,
    name: c.name,
    number: c.number || 'N/A',
    status: c.status
  })));

  return validConnections;
};

// Seleccionar siguiente conexión en rotación
const getNextConnection = async (): Promise<Whatsapp | null> => {
  const available = await getAvailableConnections();
  
  if (available.length === 0) {
    console.error('[wbot-queue] ❌ No hay conexiones con sesión activa');
    return null;
  }

  // Rotación circular
  const connection = available[rotationState.lastUsedIndex % available.length];
  rotationState.lastUsedIndex++;
  
  console.log(`[wbot-queue] 🔄 Rotación: Usando conexión ID=${connection.id}, Nombre="${connection.name}", Número=${connection.number || 'N/A'} (${rotationState.lastUsedIndex}/${available.length} disponibles)`);
  
  return connection;
};

const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

const processQueue = async () => {
  if (queueState.processing) return;
  queueState.processing = true;

  console.log(`[wbot-queue] 🚀 Iniciando procesamiento de cola (${queueState.queue.length} mensajes)`);

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
      // Seleccionar conexión dinámicamente
      const selectedConnection = await getNextConnection();
      
      if (!selectedConnection) {
        console.error('[wbot-queue] ❌ No hay conexiones disponibles');
        message.sendMessageRequest.status = 'failed';
        await message.sendMessageRequest.save();
        continue;
      }

      console.log(`[wbot-queue] ✅ Conexión seleccionada - ID: ${selectedConnection.id}, Nombre: ${selectedConnection.name}, Número: ${selectedConnection.number || 'N/A'}`);

      // Obtener sesión (ya validamos que existe)
      const wbot = getWbot(selectedConnection.id);

      // Validar que wbot existe
      if (!wbot) {
        console.error('[wbot-queue] ❌ wbot no existe para whatsappId:', selectedConnection.id);
        message.sendMessageRequest.status = 'failed';
        await message.sendMessageRequest.save();
        continue;
      }

      // Intentar aplicar parches si tiene pupPage (opcional, no crítico)
      // Los parches mejoran la funcionalidad pero wbot.sendMessage() funciona sin ellos
      if ((wbot as any)?.pupPage) {
        try {
          console.log('[wbot-queue] 🔧 Intentando aplicar parches para whatsappId:', selectedConnection.id);
          const patched = await applyPatchesToWbot(wbot as any);
          if (patched) {
            console.log('[wbot-queue] ✅ Parches aplicados exitosamente');
          } else {
            console.warn('[wbot-queue] ⚠️ Parches no aplicados - continuando sin parches (wbot.sendMessage() debería funcionar)');
          }
        } catch (patchError: any) {
          console.warn('[wbot-queue] ⚠️ Error al aplicar parches:', patchError?.message || patchError);
          console.warn('[wbot-queue] ⚠️ Continuando sin parches - usando método nativo de la librería');
        }
      }

      // Validar que el número esté registrado en WhatsApp
      console.log(`[wbot-queue] 🔍 Validando número ${message.toNumber} en WhatsApp...`);
      
      const isRegistered = await wbot.isRegisteredUser(`${message.toNumber}@c.us`);
      
      if (!isRegistered) {
        console.error(`[wbot-queue] ❌ El número ${message.toNumber} no está registrado en WhatsApp`);
        message.sendMessageRequest.status = 'failed';
        await message.sendMessageRequest.save();
        continue;
      }

      // Obtener el ID correcto del número
      const numberId = await wbot.getNumberId(`${message.toNumber}@c.us`);
      
      if (!numberId) {
        console.error(`[wbot-queue] ❌ No se pudo obtener el ID del número ${message.toNumber}`);
        message.sendMessageRequest.status = 'failed';
        await message.sendMessageRequest.save();
        continue;
      }

      console.log(`[wbot-queue] ✅ Número validado: ${numberId._serialized}`);

      // Enviar mensaje usando el numberId._serialized
      console.log(`[wbot-queue] 📤 Enviando desde ${selectedConnection.number || selectedConnection.name} a ${message.toNumber}`);
      
      if (message.mediaUrl) {
        const media = await MessageMedia.fromUrl(message.mediaUrl);
        await wbot.sendMessage(numberId._serialized, media, {
          caption: message.message
        });
      } else {
        await wbot.sendMessage(numberId._serialized, message.message);
      }

      message.sendMessageRequest.status = 'sent';
      queueState.lastSentTimestamp = Date.now();

      console.log(`[wbot-queue] ✅ Mensaje enviado exitosamente desde ${selectedConnection.number || selectedConnection.name} a ${message.toNumber}`);

    } catch (error: any) {
      console.error('[wbot-queue] ❌ Error enviando mensaje:', error?.message || error);
      message.sendMessageRequest.status = 'failed';
    }

    await message.sendMessageRequest.save();
  }

  queueState.processing = false;
  console.log('[wbot-queue] ✅ Procesamiento de cola completado');
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
  if (!toNumber || !message) {
    mensajes.push('Faltan datos necesarios para enviar el mensaje');
  }

  if (isNaN(Number(toNumber.replace(/\D/g, '')))) {
    mensajes.push('Número de teléfono de destino inválido');
  }

  if (!mensajes.length) {
    // Limpiar número
    toNumber = toNumber.replace(/\D/g, '').trim();
    
    console.log(`[wbot-queue] � Nuevo mensaje en cola para: ${toNumber}`);

    const sendMessageRequest = await SendMessageRequest.create({
      fromNumber: '', // Se asignará dinámicamente al procesar
      toNumber,
      message,
    });

    queueState.queue.push({ 
      fromNumber: '', // No importa, se selecciona dinámicamente
      toNumber, 
      message, 
      mediaUrl, 
      sendMessageRequest 
    });
    
    console.log(`[wbot-queue] 📨 Mensaje agregado a la cola. Total en cola: ${queueState.queue.length}`);

    if (!queueState.processing) {
      processQueue();
    }

    data = { sendMessageRequest };
  }

  return { mensajes, data };
};
