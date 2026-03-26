import { MessageMedia } from "whatsapp-web.js";
import { Op } from "sequelize";
import SendMessageRequest from "../../models/SendMessageRequest";
import { getWbot, applyPatchesToWbot, hasActiveSession } from "../../libs/wbot";
import Whatsapp from "../../models/Whatsapp";

// Helper: Timeout individual para operaciones
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T | null> => {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))
  ]);
};

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

  try {
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
        if ((wbot as any)?.pupPage) {
          try {
            console.log('[wbot-queue] 🔧 Intentando aplicar parches para whatsappId:', selectedConnection.id);
            const patched = await applyPatchesToWbot(wbot as any);
            if (patched) {
              console.log('[wbot-queue] ✅ Parches aplicados exitosamente');
            } else {
              console.warn('[wbot-queue] ⚠️ Parches no aplicados - continuando sin parches');
            }
          } catch (patchError: any) {
            console.warn('[wbot-queue] ⚠️ Error al aplicar parches:', patchError?.message || patchError);
          }
        }

        // Validación con timeout de 30 segundos
        try {
          const isRegistered = await withTimeout(
            wbot.isRegisteredUser(`${message.toNumber}@c.us`),
            30000
          );
          
          if (isRegistered === null) {
            console.warn(`[wbot-queue] ⚠️ Timeout validando ${message.toNumber}, enviando sin validar`);
          } else if (!isRegistered) {
            console.error(`[wbot-queue] ❌ Número ${message.toNumber} no registrado en WhatsApp`);
            message.sendMessageRequest.status = 'failed';
            await message.sendMessageRequest.save();
            continue;
          }

          // Intentar enviar directamente
          console.log(`[wbot-queue] 📤 Enviando desde ${selectedConnection.number || selectedConnection.name} a ${message.toNumber}`);
          
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

          console.log(`[wbot-queue] ✅ Mensaje enviado exitosamente desde ${selectedConnection.number || selectedConnection.name} a ${message.toNumber}`);

        } catch (error: any) {
          // Si falla envío directo, intentar con getNumberId
          console.warn(`[wbot-queue] ⚠️ Error en envío directo, intentando con getNumberId:`, error?.message);
          
          try {
            const numberId = await withTimeout(
              wbot.getNumberId(`${message.toNumber}@c.us`),
              30000
            );
            
            if (numberId) {
              console.log(`[wbot-queue] ✅ Número validado: ${numberId._serialized}`);
              
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
              
              console.log(`[wbot-queue] ✅ Mensaje enviado con getNumberId desde ${selectedConnection.number || selectedConnection.name} a ${message.toNumber}`);
            } else {
              throw new Error('Timeout obteniendo numberId');
            }
          } catch (retryError: any) {
            console.error('[wbot-queue] ❌ Error enviando mensaje:', retryError?.message || retryError);
            message.sendMessageRequest.status = 'failed';
          }
        }

      } catch (error: any) {
        console.error('[wbot-queue] ❌ Error procesando mensaje:', error?.message || error);
        message.sendMessageRequest.status = 'failed';
      }

      await message.sendMessageRequest.save();
    }
  } catch (error: any) {
    console.error('[wbot-queue] ❌ Error crítico en processQueue:', error?.message || error);
  } finally {
    queueState.processing = false;
    console.log('[wbot-queue] ✅ Procesamiento de cola completado');
  }
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

// Recuperar mensajes pendientes de BD al iniciar
export const recoverPendingMessages = async () => {
  try {
    console.log('[wbot-queue] 🔄 Recuperando mensajes pendientes de BD...');
    
    const pendingMessages = await SendMessageRequest.findAll({
      where: { status: 'pending' },
      order: [['createdAt', 'ASC']]
    });
    
    console.log(`[wbot-queue] 📋 Encontrados ${pendingMessages.length} mensajes pendientes en BD`);
    
    if (pendingMessages.length === 0) {
      console.log('[wbot-queue] ✅ No hay mensajes pendientes para recuperar');
      return;
    }
    
    pendingMessages.forEach(msg => {
      queueState.queue.push({
        fromNumber: '',
        toNumber: msg.toNumber,
        message: msg.message,
        mediaUrl: null,
        sendMessageRequest: msg
      });
    });
    
    console.log(`[wbot-queue] ✅ ${pendingMessages.length} mensajes agregados a la cola en memoria`);
    
    if (queueState.queue.length > 0 && !queueState.processing) {
      console.log('[wbot-queue] 🚀 Iniciando procesamiento de mensajes recuperados');
      processQueue();
    }
  } catch (error: any) {
    console.error('[wbot-queue] ❌ Error recuperando mensajes pendientes:', error?.message || error);
  }
};

// Reintentar SOLO mensajes fallidos con límite de intentos
export const retryFailedMessages = async (maxAttempts: number = 3) => {
  try {
    console.log('[wbot-queue] 🔄 Buscando mensajes FAILED para reintentar...');
    
    // CRÍTICO: Solo mensajes con status='failed' y que no hayan superado el límite
    const failedMessages = await SendMessageRequest.findAll({
      where: { 
        status: 'failed', // SOLO failed, NUNCA sent
        timesAttempted: {
          [Op.lt]: maxAttempts
        }
      },
      order: [['createdAt', 'ASC']],
      limit: 50 // Limitar a 50 mensajes por ejecución
    });
    
    console.log(`[wbot-queue] 📋 Encontrados ${failedMessages.length} mensajes FAILED para reintentar (intentos < ${maxAttempts})`);
    
    if (failedMessages.length === 0) {
      return { retried: 0 };
    }
    
    // Cambiar status a pending para que se procesen
    await SendMessageRequest.update(
      { status: 'pending' },
      {
        where: {
          id: failedMessages.map(m => m.id)
        }
      }
    );
    
    // Agregar a cola
    failedMessages.forEach(msg => {
      queueState.queue.push({
        fromNumber: '',
        toNumber: msg.toNumber,
        message: msg.message,
        mediaUrl: null,
        sendMessageRequest: msg
      });
    });
    
    console.log(`[wbot-queue] ✅ ${failedMessages.length} mensajes FAILED agregados para reintento`);
    
    if (queueState.queue.length > 0 && !queueState.processing) {
      processQueue();
    }
    
    return { retried: failedMessages.length };
  } catch (error: any) {
    console.error('[wbot-queue] ❌ Error reintentando mensajes fallidos:', error?.message || error);
    return { retried: 0, error: error.message };
  }
};
