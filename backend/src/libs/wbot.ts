import qrCode from "qrcode-terminal";
import { Op } from "sequelize";
import {
  Chat,
  Client,
  LocalAuth,
  Message as WbotMessage
} from "whatsapp-web.js";
import AppError from "../errors/AppError";
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

const syncUnreadMessages = async ({
  wbot,
  allWhatsappTickets,
  whatsapp
}: {
  wbot: Session;
  allWhatsappTickets: Ticket[];
  whatsapp: Whatsapp;
}) => {
  const response: {
    logs: any[];
    error: any;
  } = {
    logs: [`START searchForUnSaveMessages - wpp: ${whatsapp.name}`],
    error: null
  };

  try {
    emitEvent({
      event: {
        name: "startSyncUnreadMessages",
        data: { connectionName: whatsapp.name }
      }
    });

    response.logs.push(`START - wbot.getChats ${Date.now()}`);

    let chats = await wbot.getChats();

    response.logs.push(`END - wbot.getChats ${Date.now()}`);

    // filter chats with last message in the last 40 hours
    let last8HoursChats = chats.filter(chat =>
      chat.lastMessage
        ? chat.lastMessage.timestamp > Date.now() / 1000 - 144000 // 40 hours in seconds
        : false
    );

    response.logs.push(`last40HoursChats ...`);
    response.logs.push(last8HoursChats.map(chat => chat.name));

    response.logs.push(`START - evaluteChats ${Date.now()}`);
    await Promise.all(
      last8HoursChats.map(async chat => {
        try {
          const chatContact = await Contact.findOne({
            where: {
              number: chat.id.user
            }
          });

          const lastTicketForThisChat = allWhatsappTickets.find(t => {
            return t.contactId === chatContact?.id;
          });

          let timestampUpToFetchMessages = Date.now() / 1000 - 144000; // 40 hours in seconds

          if (
            lastTicketForThisChat &&
            lastTicketForThisChat.messages.length > 0 &&
            lastTicketForThisChat.messages[0].timestamp
          ) {
            timestampUpToFetchMessages =
              lastTicketForThisChat.messages[0].timestamp;
          }

          const wppMessagesAfterLastMessageTimestamp =
            await fetchWbotMessagesGraduallyUpToATimestamp({
              limit: 20,
              timestamp: timestampUpToFetchMessages,
              wbotChat: chat
            });

          if (wppMessagesAfterLastMessageTimestamp.length > 0) {
            for (const msg of wppMessagesAfterLastMessageTimestamp) {
              await handleMessage({ msg, wbot });
            }
          }

          // @ts-ignore
          chat.myProperty_FoundMessages =
            wppMessagesAfterLastMessageTimestamp.length;
        } catch (error) {
          response.logs.push(`ERROR - evaluteChats ${Date.now()}`);
          response.logs.push(error);
          response.error = error;
        }
      })
    );
    response.logs.push(`END - evaluteChats ${Date.now()}`);

    const messagesCount = last8HoursChats.reduce(
      // @ts-ignore
      (acc, chat) => acc + (chat.myProperty_FoundMessages || 0),
      0
    );

    response.logs.push(`messagesCount: ${messagesCount}`);

    emitEvent({
      event: {
        name: "endSyncUnreadMessages",
        data: {
          connectionName: whatsapp.name,
          messagesCount: last8HoursChats.reduce(
            // @ts-ignore
            (acc, chat) => acc + (chat.myProperty_FoundMessages || 0),
            0
          )
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
    response.logs.push(last8HoursChats.map(chat => chat.name));

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
              await handleMessage({ msg, wbot, searchForUnSaveMessages: true });
            }
          }

          // @ts-ignore
          chat.myProperty_FoundMessagesLength =
            wppMessagesFoundInTimeInterval.length;

          // @ts-ignore
          chat.myProperty_FoundMessages = wppMessagesFoundInTimeInterval.map(
            msg => msg.body
          );
        } catch (error) {
          response.logs.push(`ERROR - evaluteChats ${Date.now()}`);
          response.logs.push(error);
          response.error = error;
        }
      })
    );

    response.logs.push(`END - evaluteChats ${Date.now()}`);

    const messagesCount = last8HoursChats.reduce(
      // @ts-ignore
      (acc, chat) => acc + (chat.myProperty_FoundMessagesLength || 0),
      0
    );
    const messages = last8HoursChats.reduce(
      // @ts-ignore
      (acc, chat) => acc.concat(chat.myProperty_FoundMessages || []),
      []
    );

    response.logs.push(`messagesCount: ${messagesCount} ...`);
    response.logs.push(`messages: ${messages}`);
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

      let sessionCfg;

      if (whatsapp && whatsapp.session) {
        sessionCfg = JSON.parse(whatsapp.session);
      }

      const args: String = process.env.CHROME_ARGS || "";

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
          args: args.split(" ")
        }
      });

      wbot.initialize();

      wbot.on("qr", async qr => {
        logger.info("Session:", sessionName);
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

        // io.emit("whatsappSession", {
        //   action: "update",
        //   session: whatsapp
        // });

        const url = process.env.NODE_URL + "/toEmit";
        fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            event: {
              name: "whatsappSession",
              data: {
                action: "update",
                session: whatsapp
              }
            }
          })
        })
          .then(response => {
            if (!response.ok) {
              throw new Error(
                "Network response was not ok " + response.statusText
              );
            }
            return response.json();
          })
          .then(data => {
            console.log("Success:", data);
          })
          .catch(error => {
            console.error("Error:", error);
          });
      });

      wbot.on("authenticated", async session => {
        logger.info(`Session: ${sessionName} AUTHENTICATED`);
      });

      wbot.on("auth_failure", async msg => {
        console.error(
          `Session: ${sessionName} AUTHENTICATION FAILURE! Reason: ${msg}`
        );

        if (whatsapp.retries > 1) {
          await whatsapp.update({ session: "", retries: 0 });
        }

        const retry = whatsapp.retries;
        await whatsapp.update({
          status: "DISCONNECTED",
          retries: retry + 1
        });

        // io.emit("whatsappSession", {
        //   action: "update",
        //   session: whatsapp
        // });

        const url = process.env.NODE_URL + "/toEmit";
        fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            event: {
              name: "whatsappSession",
              data: {
                action: "update",
                session: whatsapp
              }
            }
          })
        })
          .then(response => {
            if (!response.ok) {
              throw new Error(
                "Network response was not ok " + response.statusText
              );
            }
            return response.json();
          })
          .then(data => {
            console.log("Success:", data);
          })
          .catch(error => {
            console.error("Error:", error);
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

        wbot.sendPresenceAvailable();

        const allWhatsappTickets = await Ticket.findAll({
          attributes: ["id", "contactId"],
          where: {
            whatsappId: whatsapp.id
          },
          order: [["createdAt", "DESC"]],
          include: [
            {
              model: Message,
              as: "messages",
              attributes: ["id", "body", "timestamp"],
              order: [["timestamp", "DESC"]],
              required: false,
              limit: 1
            }
          ]
        });

        try {
          const syncUnreadMessagesResult = await syncUnreadMessages({
            wbot,
            allWhatsappTickets,
            whatsapp
          });

          console.log(
            "--- syncUnreadMessagesResult: ",
            syncUnreadMessagesResult
          );
        } catch (error) {
          console.log("--- error on syncUnreadMessages: ", error);
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
