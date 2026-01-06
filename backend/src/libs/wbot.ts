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
  const startTime = Date.now();
  const memUsage = process.memoryUsage();
  
  const response: {
    logs: any[];
    error: any;
    messagesCount: number;
  } = {
    logs: [
      `[${new Date().toISOString()}] START searchForUnSaveMessages - wpp: ${whatsapp.name} (ID: ${whatsapp.id})`,
      `[MEMORY] heapUsed: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB, rss: ${Math.round(memUsage.rss / 1024 / 1024)}MB`
    ],
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

    const getChatsStartTime = Date.now();
    response.logs.push(`[${new Date().toISOString()}] START wbot.getChats - timeout: 60s`);

    // TIMEOUT DE 60 SEGUNDOS: Si getChats() tarda más, rechazar para no bloquear Node.js
    // Sesiones normales tardan <1 segundo, sesiones con problemas pueden tardar minutos
    const GET_CHATS_TIMEOUT = 60000; // 60 segundos
    
    let chats;
    try {
      chats = await Promise.race([
        wbot.getChats(),
        new Promise<Chat[]>((_, reject) =>
          setTimeout(
            () => reject(new Error(`getChats() timeout after ${GET_CHATS_TIMEOUT / 1000}s - Sesión posiblemente corrupta`)),
            GET_CHATS_TIMEOUT
          )
        )
      ]);
      
      const getChatsElapsed = Date.now() - getChatsStartTime;
      response.logs.push(
        `[${new Date().toISOString()}] END wbot.getChats - elapsed: ${getChatsElapsed}ms - chats found: ${chats.length}`
      );
    } catch (error) {
      const getChatsElapsed = Date.now() - getChatsStartTime;
      response.logs.push(
        `[${new Date().toISOString()}] ERROR wbot.getChats - elapsed: ${getChatsElapsed}ms - ${error.message}`
      );
      response.logs.push(
        `[${new Date().toISOString()}] RECOMENDACIÓN: Reiniciar sesión whatsappId: ${whatsapp.id} desde la UI`
      );
      throw error;
    }

    // filter chats with last message in the last x hours
    let last8HoursChats = chats.filter(chat =>
      chat.lastMessage
        ? chat.lastMessage.timestamp >
          Date.now() / 1000 - timeIntervalInHours * 3600 // convert x hours in seconds
        : false
    );

    response.logs.push(
      `[${new Date().toISOString()}] Chats filtered: ${last8HoursChats.length} (from ${chats.length} total) - timeInterval: ${timeIntervalInHours}h`
    );

    const evaluateStartTime = Date.now();
    response.logs.push(`[${new Date().toISOString()}] START evaluteChats - processing ${last8HoursChats.length} chats`);
    
    let processedChats = 0;
    let errorChats = 0;
    
    await Promise.all(
      last8HoursChats.map(async (chat, index) => {
        const chatStartTime = Date.now();
        try {
          // Log cada 10 chats procesados
          if (index % 10 === 0) {
            response.logs.push(`[${new Date().toISOString()}] Processing chat ${index + 1}/${last8HoursChats.length} - name: ${chat.name || 'N/A'}`);
          }
          
          let timestampUpToFetchMessages =
            Date.now() / 1000 - timeIntervalInHours * 3600; // convert x hours in seconds

          let wppMessagesFoundInTimeInterval =
            await fetchWbotMessagesGraduallyUpToATimestamp({
              limit: 20,
              timestamp: timestampUpToFetchMessages,
              wbotChat: chat
            });

          if (wppMessagesFoundInTimeInterval.length > 0) {
            const wppMessagesFoundInTimeIntervalThatAlreadySave =
              await Message.findAll({
                where: {
                  id: {
                    [Op.in]: wppMessagesFoundInTimeInterval.map(
                      msg => msg.id.id
                    )
                  }
                }
              });

            // queremos solo los que no hemos filtrado
            wppMessagesFoundInTimeInterval =
              wppMessagesFoundInTimeInterval.filter(
                msg =>
                  !wppMessagesFoundInTimeIntervalThatAlreadySave.find(
                    msgSaved => msgSaved.id === msg.id.id
                  ) && isValidMsg(msg)
              );

            for (const msg of wppMessagesFoundInTimeInterval) {
              await handleMessage({ msg, wbot });
            }
          }

          // @ts-ignore
          chat.myProperty_FoundMessagesLength =
            wppMessagesFoundInTimeInterval.length;

          // @ts-ignore
          chat.myProperty_FoundMessages = wppMessagesFoundInTimeInterval.map(
            msg => msg.body
          );
          
          processedChats++;
          const chatElapsed = Date.now() - chatStartTime;
          
          // Log si el chat toma mas de 10 segundos
          if (chatElapsed > 10000) {
            response.logs.push(
              `[${new Date().toISOString()}] SLOW CHAT - name: ${chat.name || 'N/A'} - elapsed: ${chatElapsed}ms - messages: ${wppMessagesFoundInTimeInterval.length}`
            );
          }
        } catch (error) {
          errorChats++;
          const chatElapsed = Date.now() - chatStartTime;
          response.logs.push(
            `[${new Date().toISOString()}] ERROR evaluteChat #${index + 1} - name: ${chat.name || 'N/A'} - elapsed: ${chatElapsed}ms`
          );
          response.logs.push(error);
          response.error = error;
        }
      })
    );

    const evaluateElapsed = Date.now() - evaluateStartTime;
    response.logs.push(
      `[${new Date().toISOString()}] END evaluteChats - elapsed: ${evaluateElapsed}ms - processed: ${processedChats}/${last8HoursChats.length} - errors: ${errorChats}`
    );

    const messagesCount = last8HoursChats.reduce(
      // @ts-ignore
      (acc, chat) => acc + (chat.myProperty_FoundMessagesLength || 0),
      0
    );
    
    const totalElapsed = Date.now() - startTime;
    const finalMemUsage = process.memoryUsage();
    const memDiff = Math.round((finalMemUsage.heapUsed - memUsage.heapUsed) / 1024 / 1024);

    response.logs.push(
      `[${new Date().toISOString()}] SUMMARY - messagesCount: ${messagesCount} - totalTime: ${totalElapsed}ms - memoryDiff: ${memDiff}MB`
    );
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
    const totalElapsed = Date.now() - startTime;
    const finalMemUsage = process.memoryUsage();
    
    response.logs.push(
      `[${new Date().toISOString()}] CRITICAL ERROR - whatsapp: ${whatsapp.name} (ID: ${whatsapp.id}) - elapsed: ${totalElapsed}ms`
    );
    response.logs.push(
      `[MEMORY] heapUsed: ${Math.round(finalMemUsage.heapUsed / 1024 / 1024)}MB, rss: ${Math.round(finalMemUsage.rss / 1024 / 1024)}MB`
    );
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

      let sessionCfg;

      if (whatsapp && whatsapp.session) {
        sessionCfg = JSON.parse(whatsapp.session);
      }

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
        session: sessionCfg,
        authStrategy: new LocalAuth({
          clientId: `bd_${whatsapp.sessionUuid || whatsapp.id}`
        }),
        puppeteer: {
          headless: true,
          ignoreHTTPSErrors: true,
          executablePath: process.env.CHROME_BIN || undefined,
          // @ts-ignore
          browserWSEndpoint: process.env.CHROME_WS || undefined,
          args: args.split(" "),
          // @ts-ignore - Agregar protocolTimeout para evitar timeouts de Puppeteer
          protocolTimeout: 300000 // 5 minutos en milisegundos
        }
      });
      
      logger.info(
        `[${new Date().toISOString()}] wbot Client created - id: ${whatsapp.id} - protocolTimeout: 300s`
      );

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

      wbot.on("authenticated", async session => {
        logger.info(`[${new Date().toISOString()}] Session: ${sessionName} AUTHENTICATED - id: ${whatsapp.id}`);
      });

      wbot.on("disconnected", async (reason) => {
        logger.error(
          `[${new Date().toISOString()}] Session: ${sessionName} DISCONNECTED - id: ${whatsapp.id} - reason: ${reason}`
        );
        
        await whatsapp.update({
          status: "DISCONNECTED",
          qrcode: ""
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
        if (sessionIndex !== -1) {
          sessions.splice(sessionIndex, 1);
        }
      });

      wbot.on("auth_failure", async msg => {
        logger.error(
          `[${new Date().toISOString()}] Session: ${sessionName} AUTHENTICATION FAILURE - id: ${whatsapp.id} - reason: ${msg}`
        );

        if (whatsapp.retries > 1) {
          await whatsapp.update({ session: "", retries: 0 });
        }

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
        const memUsage = process.memoryUsage();
        logger.info(
          `[${new Date().toISOString()}] Session: ${sessionName} READY - id: ${whatsapp.id} - heap: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`
        );

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

        wbot.sendPresenceAvailable();

        const syncStartTime = Date.now();
        try {
          logger.info(
            `[${new Date().toISOString()}] Session: ${sessionName} START searchForUnSaveMessages (ON READY) - id: ${whatsapp.id}`
          );

          const searchForUnSaveMessagesResult = await searchForUnSaveMessages({
            wbot,
            whatsapp,
            // timeIntervalInHours: 72
            timeIntervalInHours: 24
          });

          const syncElapsed = Date.now() - syncStartTime;
          
          // Si hubo error pero no critico, solo loguear (no tumbar la sesion)
          if (searchForUnSaveMessagesResult.error) {
            logger.error(
              `[${new Date().toISOString()}] Session: ${sessionName} searchForUnSaveMessages (ON READY) error (non-critical) - elapsed: ${syncElapsed}ms - id: ${whatsapp.id}`,
              searchForUnSaveMessagesResult.error
            );
          } else {
            logger.info(
              `[${new Date().toISOString()}] Session: ${sessionName} searchForUnSaveMessages (ON READY) SUCCESS - messages: ${searchForUnSaveMessagesResult.messagesCount} - elapsed: ${syncElapsed}ms - id: ${whatsapp.id}`
            );
          }

          console.log(
            `[${new Date().toISOString()}] Session: ${sessionName} syncUnreadMessagesResult (ON READY): `,
            searchForUnSaveMessagesResult
          );
        } catch (criticalError) {
          const syncElapsed = Date.now() - syncStartTime;
          // CRITICAL ERROR (timeout, crash) - NO tumbar la sesión, solo loguear y continuar
          logger.error(
            `[${new Date().toISOString()}] Session: ${sessionName} CRITICAL ERROR on syncUnreadMessages (ON READY) - elapsed: ${syncElapsed}ms - id: ${whatsapp.id} - RECOMENDACIÓN: Reiniciar sesión desde UI`,
            criticalError
          );
          console.log(
            `[${new Date().toISOString()}] Session: ${sessionName} error on syncUnreadMessages (ON READY): `,
            criticalError
          );
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
    console.log("sessions not found for whatsappId", whatsappId);
    throw new AppError("ERR_WAPP_NOT_INITIALIZED");
  }
  return sessions[sessionIndex];
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
