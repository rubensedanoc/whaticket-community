import * as Sentry from "@sentry/node";
import gracefulShutdown from "http-graceful-shutdown";
import cron from "node-cron";
import app from "./app";
import { initIO } from "./libs/socket";
import { getWbot, searchForUnSaveMessages } from "./libs/wbot";
import { StartAllWhatsAppsSessions } from "./services/WbotServices/StartAllWhatsAppsSessions";
import ListWhatsAppsService from "./services/WhatsappService/ListWhatsAppsService";
import { logger } from "./utils/logger";

const server = app.listen(process.env.PORT, () => {
  logger.info(`Server started on port: ${process.env.PORT}`);
});

initIO();
StartAllWhatsAppsSessions();
gracefulShutdown(server);

cron.schedule("0 * * * *", async () => {
  logger.info("--- searchForUnSaveMessages CRON: ");

  try {
    let whatsapps = await ListWhatsAppsService();

    // whatsapps = whatsapps.filter(whatsapp => whatsapp.id === 24);

    whatsapps = whatsapps.filter(whatsapp => whatsapp.status === "CONNECTED");

    // console.log(
    //   "whatsapps",
    //   whatsapps.map(whatsapp => whatsapp.id)
    // );

    whatsapps.forEach(async whatsapp => {
      const wbot = getWbot(whatsapp.id);

      const searchForUnSaveMessagesResult = await searchForUnSaveMessages({
        wbot,
        whatsapp,
        timeIntervalInHours: 6
      });

      console.log(
        "--- searchForUnSaveMessagesResult: ",
        searchForUnSaveMessagesResult
      );

      if (searchForUnSaveMessagesResult.messagesCount) {
        fetch(
          "http://microservices.restaurant.pe/chat/public/rest/common/sendWhatAppMessage",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              telefono: "51987918828",
              texto: `--- searchForUnSaveMessagesResult: ${JSON.stringify(
                searchForUnSaveMessagesResult,
                null,
                2
              )}`,
              type: "text"
            })
          }
        );
      }
    });
  } catch (err) {
    Sentry.captureException(err);
    logger.error(err);
  }
});
