import * as Sentry from "@sentry/node";
import gracefulShutdown from "http-graceful-shutdown";
import cron from "node-cron";
import { Op, Sequelize } from "sequelize";
import app from "./app";
import { initIO } from "./libs/socket";
import { getWbot, searchForUnSaveMessages } from "./libs/wbot";
import Category from "./models/Category";
import Contact from "./models/Contact";
import Message from "./models/Message";
import Queue from "./models/Queue";
import Ticket from "./models/Ticket";
import UpdateTicketService from "./services/TicketServices/UpdateTicketService";
import { StartAllWhatsAppsSessions } from "./services/WbotServices/StartAllWhatsAppsSessions";
import ListWhatsAppsService from "./services/WhatsappService/ListWhatsAppsService";
import { logger } from "./utils/logger";

const server = app.listen(process.env.PORT, () => {
  logger.info(`Server started on port: ${process.env.PORT}`);
});

initIO();
StartAllWhatsAppsSessions();
gracefulShutdown(server);

// every hour/2 of the day
cron.schedule("*/30 * * * *", async () => {
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
        // fetch(
        //   "http://microservices.restaurant.pe/chat/public/rest/common/sendWhatAppMessage",
        //   {
        //     method: "POST",
        //     headers: {
        //       "Content-Type": "application/json"
        //     },
        //     body: JSON.stringify({
        //       telefono: "51987918828",
        //       texto: `--- searchForUnSaveMessagesResult: ${JSON.stringify(
        //         searchForUnSaveMessagesResult,
        //         null,
        //         2
        //       )}`,
        //       type: "text"
        //     })
        //   }
        // );
      }
    });
  } catch (err) {
    Sentry.captureException(err);
    logger.error(err);
  }
});

// every 20 min of every hour of the day
cron.schedule("*/20 * * * *", async () => {
  logger.info("--- categorizeTicketsWithAI CRON ");

  try {
    const queuesWithAITicketCategorization = await Queue.findAll({
      where: {
        categorizeTicketsWithAI: true
      },
      include: [
        {
          model: Category,
          as: "categories",
          required: true
        },
        {
          model: Ticket,
          as: "tickets",
          where: {
            status: "pending",
            isGroup: false,
            userId: null,
            categorizedByAI: false,
            [Op.and]: [
              Sequelize.literal(
                `NOT EXISTS (
                SELECT 1
                FROM \`TicketCategories\`
                WHERE \`TicketCategories\`.\`ticketId\`  = \`tickets\`.\`id\`
              )`
              )
            ]
          },
          required: true,
          include: [
            {
              model: Contact,
              as: "contact",
              where: {
                isCompanyMember: {
                  [Op.or]: [false, null]
                }
              },
              required: true
            },
            {
              model: Message,
              as: "messages",
              order: [["timestamp", "ASC"]],
              where: {
                mediaType: "chat",
                fromMe: false,
                isPrivate: false
              },
              required: true
            }
          ]
        }
      ]
    });

    // console.log(
    //   "queuesWithAITicketCategorization: ",
    //   queuesWithAITicketCategorization
    // );

    queuesWithAITicketCategorization.forEach(async queue => {
      const ticketsToCategorize = queue.tickets;

      Promise.all(
        ticketsToCategorize.map(ticket => {
          try {
            const messagesToSend = ticket.messages
              .filter(message => {
                return (
                  !/^[a-zA-Z0-9_-]+\.\w+$/.test(message.body) && // avoid '1721314571690.pdf'
                  message.body.length <= 1000
                );
              })
              .map(message => message.body);
            const categoriesForEvaluate = queue.categories
              .filter(
                category =>
                  category.QueueCategory?.descriptionForAICategorization
              )
              .map(
                category =>
                  `(${category.id}) ${category.name} = ${category.QueueCategory?.descriptionForAICategorization}`
              );

            if (!messagesToSend.length || !categoriesForEvaluate.length) {
              return;
            }

            fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
              },
              body: JSON.stringify({
                model: queue.categorizationOpenAIModel,
                messages: [
                  {
                    role: "system",
                    content:
                      "Eres un asistente del área de atención al cliente de Restaurant.pe, una empresa de software para la gestión de restaurantes presente en toda latinoamérica. Ofrecemos una variedad de productos innovadores, como apps móviles, encuestas, herramientas de self-service y servicios de facturación especializados para cada país. Nuestro enfoque es crecer rápidamente, reducir el abandono y aumentar las ventas."
                  },
                  {
                    role: "user",
                    content: `Te pasare el inicio de una conversación entre un cliente y nuestro chat de atención, junto a las categorías actuales con las cuáles categorizamos este tipo de conversaciones. Necesito que categorices la conversación con alguna de las opciones brindadas, y me devuelvas únicamente el ID númerico de la categoría correspondiente. Si consideras que la conversación no cumple con los requisitos para ser categorizada con alguna de las opciones (como por ejemplo: simples saludos, cosas sin sentido, etc), devuelve “null”. Las categorías son las siguientes: ${categoriesForEvaluate.join(
                      " "
                    )} Inicio de la conversación: '${messagesToSend.join(" ")}'`
                  }
                ]
              })
            })
              .then(response => {
                if (response.ok) {
                  return response.json();
                }
                console.log("response", response);
                throw new Error("Error en la petición");
              })
              .then(async data => {
                const AICategory = JSON.parse(
                  data.choices[0].message.content
                ) as number | null;

                await UpdateTicketService({
                  ticketData: {
                    categorizedByAI: true,
                    ...(AICategory && { categoriesIds: [AICategory] })
                  },
                  ticketId: ticket.id
                });

                console.log("categorizeTicketsWithAI", {
                  ticketId: ticket.id,
                  categoriaId: AICategory,
                  mensajes: messagesToSend.join(" "),
                  categories: categoriesForEvaluate.join(" ")
                });

                // Sentry.captureMessage(
                //   `ticketId: ${
                //     ticket.id
                //   } + categoriaId: ${AICategory} + mensajes: ${messagesToSend.join(
                //     " "
                //   )}`
                // );
              })
              .catch(error => {
                console.log("error", error);
                Sentry.captureException(error);
              });
          } catch (error) {
            console.log("error", error);
            Sentry.captureException(error);
          }
        })
      );
    });
  } catch (error) {
    console.log("error", error);
  }
});
