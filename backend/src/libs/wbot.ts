import qrCode from "qrcode-terminal";
import { literal, Op } from "sequelize";
import {
  Chat,
  Client,
  LocalAuth,
  Message as WbotMessage
} from "whatsapp-web.js";
import Contact from "../models/Contact";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import Whatsapp from "../models/Whatsapp";
import {
  handleMessage,
  isValidMsg
} from "../services/WbotServices/wbotMessageListener";
import { logger } from "../utils/logger";
import { emitEvent } from "./emitEvent";
import AppError from "../errors/AppError";

interface Session extends Client {
  id?: number;
}

const sessions: Session[] = [];

const fetchWbotMessagesGraduallyUpToATimestamp = async ({
  wbotChat,
  limit,
  timestamp
}: {
  wbotChat: Chat;
  limit?: number;
  timestamp: number;
}): Promise<WbotMessage[]> => {
  const chatMessages = await wbotChat.fetchMessages({ limit });

  const msgBeforeTimestampFound = chatMessages.find(
    msg => msg.timestamp <= timestamp
  );

  if (!msgBeforeTimestampFound && limit < 1000) {
    return fetchWbotMessagesGraduallyUpToATimestamp({
      wbotChat,
      limit: limit + 20,
      timestamp
    });
  }

  return chatMessages.filter(msg => msg.timestamp > timestamp);
};

export const searchForUnSaveMessages = async ({
  wbot,
  whatsapp,
  timeIntervalInHours
}: {
  wbot: Session;
  whatsapp: Whatsapp;
  timeIntervalInHours: number;
}) => {
  const response: {
    logs: any[];
    error: any;
    messagesCount: number;
  } = {
    logs: [`START searchForUnSaveMessages - wpp: ${whatsapp.name}`],
    error: null,
    messagesCount: null
  };

  try {
    emitEvent({
      event: {
        name: "startSearchForUnSaveMessages",
        data: { connectionName: whatsapp.name }
      }
    });

    response.logs.push(`START - wbot.getChats ${Date.now()}`);

    let chats = await wbot.getChats();

    response.logs.push(`END - wbot.getChats ${Date.now()}`);

    // filter chats with last message in the last x hours
    let last8HoursChats = chats.filter(chat =>
      chat.lastMessage
        ? chat.lastMessage.timestamp >
          Date.now() / 1000 - timeIntervalInHours * 3600 // convert x hours in seconds
        : false
    );

    response.logs.push(`last${timeIntervalInHours}HoursChats ...`);
    // response.logs.push(last8HoursChats.map(chat => chat.name));

    response.logs.push(`START - evaluteChats ${Date.now()}`);
    await Promise.all(
      last8HoursChats.map(async chat => {
        try {
          let timestampUpToFetchMessages =
            Date.now() / 1000 - timeIntervalInHours * 3600; // convert x hours in seconds

          let wppMessagesFoundInTimeInterval =
            await fetchWbotMessagesGraduallyUpToATimestamp({
              limit: 20,
              timestamp: timestampUpToFetchMessages,
              wbotChat: chat
            });

          if (wppMessagesFoundInTimeInterval.length > 0) {
            // Filtrar mensajes con estructura de ID válida
            const validMessages = wppMessagesFoundInTimeInterval.filter(
              msg => msg?.id?.id
            );

            if (validMessages.length === 0) {
              // Si no hay mensajes válidos, continuar con el siguiente chat
              // @ts-ignore
              chat.myProperty_FoundMessagesLength = 0;
              // @ts-ignore
              chat.myProperty_FoundMessages = [];
            } else {
              const wppMessagesFoundInTimeIntervalThatAlreadySave =
                await Message.findAll({
                  where: {
                    id: {
                      [Op.in]: validMessages.map(msg => msg.id.id)
                    }
                  }
                });

              // queremos solo los que no hemos filtrado
              wppMessagesFoundInTimeInterval = validMessages.filter(
                msg =>
                  msg?.id?.id &&
                  !wppMessagesFoundInTimeIntervalThatAlreadySave.find(
                    msgSaved => msgSaved.id === msg.id.id
                  ) &&
                  isValidMsg(msg)
              );

              for (const msg of wppMessagesFoundInTimeInterval) {
                await handleMessage({ msg, wbot });
              }

              // @ts-ignore
              chat.myProperty_FoundMessagesLength =
                wppMessagesFoundInTimeInterval.length;

              // @ts-ignore
              chat.myProperty_FoundMessages = wppMessagesFoundInTimeInterval.map(
                msg => msg.body
              );
            }
          }
        } catch (error) {
          response.logs.push(`ERROR - evaluteChats ${Date.now()}`);
          response.logs.push({
            errorName: error?.name || 'UnknownError',
            errorMessage: error?.message || 'No error message',
            errorStack: error?.stack?.split('\n').slice(0, 3) || [],
            chatId: chat?.id?._serialized || 'unknown',
            chatName: chat?.name || 'unknown',
            isGroup: chat?.isGroup || false
          });
          if (!response.error) {
            response.error = error;
          }
        }
      })
    );

    response.logs.push(`END - evaluteChats ${Date.now()}`);

    const messagesCount = last8HoursChats.reduce(
      // @ts-ignore
      (acc, chat) => acc + (chat.myProperty_FoundMessagesLength || 0),
      0
    );
    // const messages = last8HoursChats.reduce(
    //   // @ts-ignore
    //   (acc, chat) => acc.concat(chat.myProperty_FoundMessages || []),
    //   []
    // );

    response.logs.push(`messagesCount: ${messagesCount} ...`);
    // response.logs.push(`messages: ${messages}`);
    response.messagesCount = messagesCount;

    emitEvent({
      event: {
        name: "endSearchForUnSaveMessages",
        data: {
          connectionName: whatsapp.name,
          messagesCount
        }
      }
    });
  } catch (error) {
    response.logs.push(`ERROR - ${Date.now()}`);
    response.logs.push(error);
    response.error = error;
  }

  return response;
};

export const initWbot = async (whatsapp: Whatsapp): Promise<Session> => {
  return new Promise((resolve, reject) => {
    try {
      // const io = getIO();
      const sessionName = whatsapp.name;

      logger.info(
        ` --- wbot initWbot --- id: ${whatsapp.id}  name: ${sessionName} sessionUuid: ${whatsapp.sessionUuid}`
      );

      let args: String =
        process.env.DOCKERFILE_PATH &&
        process.env.DOCKERFILE_PATH.includes("chrome")
          ? process.env.CHROME_ARGS_CHROME
          : process.env.CHROME_ARGS_CHROMIUN || "";

      if (whatsapp.id === 21 || whatsapp.id === 32) {
        args = "--no-sandbox --disable-setuid-sandbox"
      }

      // if (whatsapp.id === 31) {
      //   args = "--no-sandbox --disable-setuid-sandbox"
      // }

      console.log("client args: ", args);

      const wbot: Session = new Client({
        authStrategy: new LocalAuth({
          clientId: `bd_${whatsapp.sessionUuid || whatsapp.id}`,
          dataPath: '.wwebjs_auth'  // Carpeta donde se guardan las sesiones
        }),
        puppeteer: {
          headless: true,
          ignoreHTTPSErrors: true,
          executablePath: process.env.CHROME_BIN || undefined,
          // @ts-ignore
          browserWSEndpoint: process.env.CHROME_WS || undefined,
          args: args.split(" ")
      }
      });

      wbot.initialize();

      wbot.on("qr", async qr => {
        logger.info(`Session: ${sessionName} QR RECEIVED credentials ${whatsapp.sessionUuid || whatsapp.id}`);
        qrCode.generate(qr, { small: true });
        await whatsapp.update({ qrcode: qr, status: "qrcode", retries: 0 });

        const sessionIndex = sessions.findIndex(s => s.id === whatsapp.id);
        if (sessionIndex === -1) {
          wbot.id = whatsapp.id;
          sessions.push(wbot);
        } else {
          wbot.id = whatsapp.id;
          sessions[sessionIndex] = wbot;
        }

        emitEvent({
          event: {
            name: "whatsappSession",
            data: {
              action: "update",
              session: whatsapp
            }
          }
        });
      });

      wbot.on("authenticated", async () => {
        logger.info(`Session: ${sessionName} AUTHENTICATED`);
        // LocalAuth guarda la sesión automáticamente en .wwebjs_auth/
        // Ya no es necesario guardar session en la BD
      });

      wbot.on("auth_failure", async msg => {
        console.error(
          `Session: ${sessionName} AUTHENTICATION FAILURE! Reason: ${msg}`
        );

        // LocalAuth maneja la limpieza de sesión automáticamente
        // Solo actualizamos el estado en la BD
        const retry = whatsapp.retries;
        await whatsapp.update({
          status: "DISCONNECTED",
          retries: retry + 1
        });

        emitEvent({
          event: {
            name: "whatsappSession",
            data: {
              action: "update",
              session: whatsapp
            }
          }
        });

        reject(new Error("Error starting whatsapp session."));
      });

      wbot.on("ready", async () => {
        logger.info(`Session: ${sessionName} READY`);

        await whatsapp.update({
          status: "CONNECTED",
          qrcode: "",
          retries: 0,
          ...(wbot.info?.wid?.user && { number: wbot.info?.wid?.user })
        });

        emitEvent({
          event: {
            name: "whatsappSession",
            data: {
              action: "update",
              session: whatsapp
            }
          }
        });

        const sessionIndex = sessions.findIndex(s => s.id === whatsapp.id);
        if (sessionIndex === -1) {
          wbot.id = whatsapp.id;
          sessions.push(wbot);
        } else {
          wbot.id = whatsapp.id;
          sessions[sessionIndex] = wbot;
        }

        // Patch crítico para WhatsApp Web - Corrige errores de getChat y sendSeen
        // Debe ejecutarse ANTES de cualquier operación con el cliente
        try {
          await wbot.pupPage?.evaluate(`
            // Patch 1: Corregir sendSeen
            window.WWebJS.sendSeen = async (chatId) => {
              try {
                const chat = await window.WWebJS.getChat(chatId, { getAsModel: false });
                if (chat) {
                  window.Store.WAWebStreamModel.Stream.markAvailable();
                  await window.Store.SendSeen.markSeen(chat);
                  window.Store.WAWebStreamModel.Stream.markUnavailable();
                  return true;
                }
                return false;
              } catch (e) {
                console.error('Error in patched sendSeen:', e);
                return false;
              }
            };

            // Patch 2: Asegurar que getChat siempre devuelva un objeto válido
            const originalGetChat = window.WWebJS.getChat;
            window.WWebJS.getChat = async function(chatId, options) {
              try {
                // Intentar obtener el chat de forma normal
                const chat = await originalGetChat.call(this, chatId, options);
                if (chat) return chat;
                
                // Si no se encuentra, intentar desde Store
                const chatFromStore = window.Store.Chat.get(chatId);
                if (chatFromStore) return chatFromStore;
                
                // Si aún no existe, buscarlo de forma más robusta
                const allChats = window.Store.Chat.getModelsArray();
                const foundChat = allChats.find(c => c.id && c.id._serialized === chatId);
                if (foundChat) return foundChat;
                
                throw new Error('Chat not found: ' + chatId);
              } catch (e) {
                console.error('Error in patched getChat for chatId:', chatId, e);
                throw e;
              }
            };
          `);
          logger.info(`Session: ${sessionName} - WhatsApp Web patches applied successfully (sendSeen + getChat)`);
        } catch (patchError) {
          logger.error(`Session: ${sessionName} - CRITICAL: Failed to apply WhatsApp Web patches:`, patchError);
        }

        wbot.sendPresenceAvailable();

        try {

          logger.info(`Session: ${sessionName} searchForUnSaveMessages`);

          const searchForUnSaveMessagesResult = await searchForUnSaveMessages({
            wbot,
            whatsapp,
            // Reducido de 168 (7 días) a 24 horas para evitar timeout en getChats()
            // Con 24 horas se procesan menos chats y es más rápido
            // Los mensajes en tiempo real se capturan por eventos message_create
            timeIntervalInHours: 72
          });

          console.log(
            `Session: ${sessionName} syncUnreadMessagesResult: `,
            searchForUnSaveMessagesResult
          );
        } catch (error) {
          console.log(`Session: ${sessionName} error on syncUnreadMessages: `, error);
        }

        resolve(wbot);
      });
    } catch (err) {
      logger.error(err);
    }
  });
};

export const getWbot = (whatsappId: number): Session => {
  const sessionIndex = sessions.findIndex(s => s.id === whatsappId);

  if (sessionIndex === -1) {
    console.log("sessions not found for whatsappId", whatsappId, sessions);
    throw new AppError("ERR_WAPP_NOT_INITIALIZED");
  }
  return sessions[sessionIndex];
};

// Aplica parches en la página Puppeteer de WhatsApp Web de forma on-demand.
// Devuelve true si el parche quedó aplicado correctamente, false en caso contrario.
export const diagnoseWbotState = async (wbot: Session): Promise<any> => {
  try {
    if (!wbot?.pupPage) {
      return {
        success: false,
        error: 'pupPage no existe',
        pupPageExists: false,
        recommendation: 'Reiniciar la sesión de WhatsApp'
      };
    }

    const isClosed = wbot.pupPage.isClosed();
    if (isClosed) {
      return {
        success: false,
        error: 'pupPage está cerrada',
        pupPageExists: true,
        pupPageClosed: true,
        recommendation: 'La página de Puppeteer está cerrada, reiniciar sesión'
      };
    }

    const diagnosis = await wbot.pupPage.evaluate(() => {
      const result: any = {
        url: window.location.href,
        timestamp: new Date().toISOString(),
        // @ts-ignore
        windowWWebJSExists: typeof window.WWebJS !== 'undefined',
        // @ts-ignore
        windowStoreExists: typeof window.Store !== 'undefined',
        // @ts-ignore
        patchApplied: !!(window as any).__whaticket_patch_applied,
        // Información adicional del DOM
        documentReadyState: document.readyState,
        // @ts-ignore
        hasWebpackChunk: typeof (window as any).webpackChunkwhatsapp_web_client !== 'undefined',
        // @ts-ignore
        hasRequire: typeof (window as any).require !== 'undefined'
      };

      // Diagnóstico detallado de window.WWebJS
      // @ts-ignore
      if (typeof window.WWebJS !== 'undefined') {
        // @ts-ignore
        const wwebjs = window.WWebJS;
        result.WWebJS = {
          exists: true,
          // @ts-ignore
          keys: Object.keys(wwebjs).slice(0, 20), // Primeras 20 propiedades
          // @ts-ignore
          getChatExists: typeof wwebjs.getChat === 'function',
          // @ts-ignore
          getChatType: typeof wwebjs.getChat,
          // @ts-ignore
          sendSeenExists: typeof wwebjs.sendSeen === 'function',
          // @ts-ignore
          sendSeenType: typeof wwebjs.sendSeen,
          // @ts-ignore
          sendMessageExists: typeof wwebjs.sendMessage === 'function',
          // Verificar si getChat está parcheado
          // @ts-ignore
          getChatIsPatched: wwebjs.getChat && wwebjs.getChat.toString().includes('foundChat'),
          // @ts-ignore
          sendSeenIsPatched: wwebjs.sendSeen && wwebjs.sendSeen.toString().includes('SendSeen')
        };
      } else {
        result.WWebJS = {
          exists: false,
          error: 'window.WWebJS is undefined',
          // @ts-ignore
          windowKeys: Object.keys(window).filter(k => k.toLowerCase().includes('web')).slice(0, 10)
        };
        result.error = 'window.WWebJS is undefined';
      }

      // Diagnóstico detallado de window.Store
      // @ts-ignore
      if (typeof window.Store !== 'undefined') {
        // @ts-ignore
        const store = window.Store;
        result.Store = {
          exists: true,
          // @ts-ignore
          keys: Object.keys(store).slice(0, 30), // Primeras 30 propiedades
          // @ts-ignore
          ChatExists: typeof store.Chat !== 'undefined',
          // @ts-ignore
          ChatType: typeof store.Chat,
          // @ts-ignore
          SendSeenExists: typeof store.SendSeen !== 'undefined',
          // @ts-ignore
          SendSeenType: typeof store.SendSeen,
          // @ts-ignore
          MsgExists: typeof store.Msg !== 'undefined',
          // @ts-ignore
          WAWebStreamModelExists: typeof store.WAWebStreamModel !== 'undefined',
          // @ts-ignore
          SendMessageExists: typeof store.SendMessage !== 'undefined'
        };

        // @ts-ignore
        if (typeof store.Chat !== 'undefined') {
          // @ts-ignore
          result.Store.ChatDetails = {
            // @ts-ignore
            type: typeof store.Chat,
            // @ts-ignore
            isConstructor: store.Chat.prototype !== undefined,
            // @ts-ignore
            hasGet: typeof store.Chat.get === 'function',
            // @ts-ignore
            hasFindById: typeof store.Chat.findById === 'function'
          };
        }

        // @ts-ignore
        if (typeof store.WAWebStreamModel !== 'undefined') {
          // @ts-ignore
          result.Store.WAWebStreamModelDetails = {
            // @ts-ignore
            StreamExists: typeof store.WAWebStreamModel.Stream !== 'undefined',
            // @ts-ignore
            keys: Object.keys(store.WAWebStreamModel).slice(0, 10)
          };
        }
      } else {
        result.Store = {
          exists: false,
          error: 'window.Store is undefined',
          // Buscar objetos similares en window
          // @ts-ignore
          windowKeys: Object.keys(window).filter(k => 
            k.toLowerCase().includes('store') || 
            k.toLowerCase().includes('chat') ||
            k.toLowerCase().includes('msg')
          ).slice(0, 15)
        };
        if (!result.error) result.error = 'window.Store is undefined';
      }

      // Verificar estado de carga de WhatsApp Web
      result.whatsappWebState = {
        // @ts-ignore
        hasMainElement: !!document.querySelector('#app'),
        // @ts-ignore
        hasSidePanel: !!document.querySelector('[data-testid="chat-list"]'),
        // @ts-ignore
        hasQRCode: !!document.querySelector('canvas[aria-label*="QR"]'),
        // @ts-ignore
        isLoading: !!document.querySelector('[data-testid="startup-progress-bar"]')
      };

      result.success = result.windowWWebJSExists && result.windowStoreExists;
      
      // Generar recomendación específica
      if (!result.windowWWebJSExists && !result.windowStoreExists) {
        result.recommendation = 'Ambos window.WWebJS y window.Store no existen. WhatsApp Web no está completamente inicializado. Esperar más tiempo o reiniciar sesión.';
      } else if (!result.windowWWebJSExists) {
        result.recommendation = 'window.WWebJS no existe pero window.Store sí. Problema con la inyección de whatsapp-web.js. Verificar versión de la librería.';
      } else if (!result.windowStoreExists) {
        result.recommendation = 'window.Store no existe pero window.WWebJS sí. WhatsApp Web aún está cargando. Esperar evento "ready" o reintentar en unos segundos.';
      } else if (!result.patchApplied) {
        result.recommendation = 'Ambos objetos existen pero los parches no están aplicados. Aplicar parches ahora.';
      } else {
        result.recommendation = 'Todo OK, parches ya aplicados.';
      }

      return result;
    });

    return {
      ...diagnosis,
      pupPageExists: true,
      pupPageClosed: false
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message,
      errorName: err.name,
      errorStack: err.stack?.split('\n').slice(0, 5),
      pupPageExists: !!wbot?.pupPage,
      evaluateError: true,
      recommendation: err.message.includes('Execution context') 
        ? 'Contexto de ejecución destruido - página está navegando o recargando'
        : err.message.includes('Protocol error')
        ? 'Error de protocolo Puppeteer - conexión con navegador perdida'
        : 'Error desconocido al evaluar página'
    };
  }
};

export const applyPatchesToWbot = async (wbot: Session): Promise<boolean> => {
  try {
    logger.info('[applyPatchesToWbot] Iniciando diagnóstico previo...');
    
    if (!wbot?.pupPage) {
      logger.warn('[applyPatchesToWbot] pupPage no existe');
      return false;
    }

    if (wbot.pupPage.isClosed()) {
      logger.warn('[applyPatchesToWbot] pupPage está cerrada');
      return false;
    }

    // Primero verificar si el parche ya está aplicado
    let alreadyPatched = false;
    try {
      alreadyPatched = await wbot.pupPage.evaluate(() => {
        return !!(window as any).__whaticket_patch_applied;
      });
      
      if (alreadyPatched) {
        logger.info('[applyPatchesToWbot] ✓ Parche ya está aplicado (desde evento ready), no es necesario re-aplicar');
        return true;
      }
    } catch (checkErr: any) {
      logger.warn('[applyPatchesToWbot] No se pudo verificar si el parche ya está aplicado:', checkErr.message);
    }

    // Diagnóstico detallado del estado
    const diagnosis = await diagnoseWbotState(wbot);
    logger.info('[applyPatchesToWbot] Diagnóstico:', JSON.stringify(diagnosis, null, 2));

    if (!diagnosis.success) {
      logger.error('[applyPatchesToWbot] ✗ Diagnóstico falló:', diagnosis.error);
      
      if (!diagnosis.windowWWebJSExists) {
        logger.error('[applyPatchesToWbot] ✗ PROBLEMA: window.WWebJS no existe');
        logger.error('[applyPatchesToWbot] Causa probable: Inyección de WWebJS incompleta o timing issue');
      }
      
      if (!diagnosis.windowStoreExists) {
        logger.error('[applyPatchesToWbot] ✗ PROBLEMA: window.Store no existe');
        logger.error('[applyPatchesToWbot] Causa probable: WhatsApp Web no está completamente cargado');
      }
      
      return false;
    }

    // Verificar propiedades específicas
    if (diagnosis.WWebJS) {
      if (!diagnosis.WWebJS.getChatExists) {
        logger.error('[applyPatchesToWbot] ✗ PROBLEMA: window.WWebJS.getChat no existe');
        logger.error('[applyPatchesToWbot] Tipo actual:', diagnosis.WWebJS.getChatType);
        return false;
      }
      
      if (!diagnosis.WWebJS.sendSeenExists) {
        logger.error('[applyPatchesToWbot] ✗ PROBLEMA: window.WWebJS.sendSeen no existe');
        logger.error('[applyPatchesToWbot] Tipo actual:', diagnosis.WWebJS.sendSeenType);
        return false;
      }
      
      logger.info('[applyPatchesToWbot] ✓ window.WWebJS.getChat existe');
      logger.info('[applyPatchesToWbot] ✓ window.WWebJS.sendSeen existe');
    }

    if (diagnosis.Store) {
      logger.info('[applyPatchesToWbot] ✓ window.Store.Chat existe:', diagnosis.Store.ChatExists);
      logger.info('[applyPatchesToWbot] ✓ window.Store.SendSeen existe:', diagnosis.Store.SendSeenExists);
      logger.info('[applyPatchesToWbot] ✓ window.Store.WAWebStreamModel existe:', diagnosis.Store.WAWebStreamModelExists);
      
      if (diagnosis.Store.WAWebStreamModelExists) {
        logger.info('[applyPatchesToWbot] ✓ window.Store.WAWebStreamModel.Stream existe:', diagnosis.Store.StreamExists);
      }
    }

    logger.info('[applyPatchesToWbot] Aplicando parches...');

    // Ejecutar la misma evaluación que en el "ready" para asegurar que
    // `window.WWebJS.getChat` y `window.WWebJS.sendSeen` están parcheados.
    await wbot.pupPage.evaluate(`
      (function(){
        try {
          console.log('[Patch] Iniciando aplicación de parches...');
          
          // Patch 1: Corregir sendSeen
          window.WWebJS.sendSeen = async (chatId) => {
            try {
              const chat = await window.WWebJS.getChat(chatId, { getAsModel: false });
              if (chat) {
                window.Store.WAWebStreamModel.Stream.markAvailable();
                await window.Store.SendSeen.markSeen(chat);
                window.Store.WAWebStreamModel.Stream.markUnavailable();
                return true;
              }
              return false;
            } catch (e) {
              console.error('[Patch] Error in patched sendSeen:', e);
              return false;
            }
          };
          console.log('[Patch] ✓ sendSeen parcheado');

          // Patch 2: Asegurar que getChat siempre devuelva un objeto válido
          const originalGetChat = window.WWebJS.getChat;
          window.WWebJS.getChat = async function(chatId, options) {
            try {
              const chat = await originalGetChat.call(this, chatId, options);
              if (chat) return chat;
              const chatFromStore = window.Store.Chat.get(chatId);
              if (chatFromStore) return chatFromStore;
              const allChats = window.Store.Chat.getModelsArray();
              const foundChat = allChats.find(c => c.id && c.id._serialized === chatId);
              if (foundChat) return foundChat;
              throw new Error('Chat not found: ' + chatId);
            } catch (e) {
              console.error('[Patch] Error in patched getChat for chatId:', chatId, e);
              throw e;
            }
          };
          console.log('[Patch] ✓ getChat parcheado');

          // Señal de éxito del parche
          window.__whaticket_patch_applied = true;
          console.log('[Patch] ✓ Parches aplicados exitosamente');
        } catch (e) {
          console.error('[Patch] ✗ Error applying patches (inner):', e);
          window.__whaticket_patch_applied = false;
        }
      })();
    `);

    // Verificar la bandera del cliente
    const flag = await wbot.pupPage.evaluate(() => {
      // @ts-ignore
      return !!window.__whaticket_patch_applied;
    });

    if (flag) {
      logger.info('[applyPatchesToWbot] ✓ Parches aplicados exitosamente, bandera confirmada');
    } else {
      logger.error('[applyPatchesToWbot] ✗ Parches no se aplicaron, bandera es false');
    }

    return !!flag;
  } catch (err: any) {
    logger.error('[applyPatchesToWbot] ✗ ERROR en catch principal:');
    logger.error('[applyPatchesToWbot] Error name:', err.name);
    logger.error('[applyPatchesToWbot] Error message:', err.message);
    logger.error('[applyPatchesToWbot] Error stack:', err.stack);
    
    if (err.message && err.message.includes('Execution context was destroyed')) {
      logger.error('[applyPatchesToWbot] Causa: Contexto de ejecución de Puppeteer fue destruido');
      logger.error('[applyPatchesToWbot] Solución: La página está navegando o recargando, reintentar más tarde');
    } else if (err.message && err.message.includes('Protocol error')) {
      logger.error('[applyPatchesToWbot] Causa: Error de protocolo de Puppeteer');
      logger.error('[applyPatchesToWbot] Solución: Conexión con el navegador perdida o inestable');
    }
    
    return false;
  }
};

export const getWbots = (): Session[] => {
  return sessions;
};

export const removeWbot = (whatsappId: number): void => {
  try {
    const sessionIndex = sessions.findIndex(s => s.id === whatsappId);
    if (sessionIndex !== -1) {
      sessions[sessionIndex].destroy();
      sessions.splice(sessionIndex, 1);
    }
  } catch (err) {
    logger.error(err);
  }
};
