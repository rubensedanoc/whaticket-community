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
import CheckSettingsHelper from "./helpers/CheckSettings";
import ConversationIAEvalutaion from "./models/ConversationIAEvalutaion";

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


// Every hour of the day
cron.schedule('0 * * * *', async () => {
  try {
    // ESTA API HACE EL FILTRADO DEL ARRAY QUE LE PASO
    const response = await fetch(
      "https://microservices.restaurant.pe/backendrestaurantpe/public/rest/common/localbi/searchExclusivePhones",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({})
      }
    );

    if (!response.ok) {
      throw new Error(
        "searchForExclusiveNumbers was not ok " + response.statusText
      );
    }

    const data = await response.json();

    if (typeof data.data === "object") {

      const exclusiveNumbers = Object.keys(data.data).map(number => number.replace(/\D/g, "")).filter(number => number.length > 6);

      Contact.update(
        { isExclusive: true },
        {
          where: {
            [Op.or]: exclusiveNumbers.map(number => ({
              number: { [Op.like]: `%${number}` }
            }))
          }
        }
      );

    }
  } catch (error) {
    console.log("--- Error in searchForExclusiveNumbers", error);
    Sentry.captureException(error);
  }
});


// Every minute of every hour of the day
cron.schedule('*/10 * * * *', async () => {

  console.log("------ searchForImplementationAreaGroupsTickets CRON ------");

  try {

    const iaForTheImplementationAreaGroups = (await CheckSettingsHelper("iaForTheImplementationAreaGroups"));

    if (iaForTheImplementationAreaGroups !== "true") {
      return;
    }

    const dateToStartToConsiderateTickets = '2025-06-19';

    const ticketsToReview = await Ticket.findAll({
      attributes: ["id", "status", "createdAt", "updatedAt"],
      where: {
        whatsappId: 11,
        status: "open",
        isGroup: true,
        updatedAt: {
          [Op.gte]: dateToStartToConsiderateTickets
        },
        // id: 37378
      },
      include: [
        {
          model: Message,
          as: "messages",
          attributes: ["id", "body", "timestamp", "fromMe", "mediaType", "isPrivate"],
          order: [["timestamp", "ASC"]],
          separate: true,
          required: true,
          include: [{
            model: Contact,
            as: "contact",
            attributes: ["id", "name", "isCompanyMember"],
          }]
        },
        {
          model: Contact,
          as: "contact",
          attributes: ["id", "name", "traza_clientelicencia_id"],
          required: true,
          where: {
            traza_clientelicencia_id: {
              [Op.not]: null
            }
          }
        },
        {
          model: ConversationIAEvalutaion,
          as: "conversationIAEvalutaions",
          order: [["createdAt", "DESC"]],
          separate: true,
          where: {
            evaluationType: "implementation_area_groups_categorization"
          },
        }
      ]
    });


    console.log("--- ticketsToReview length", ticketsToReview.length);
    console.log("--- ticketsToReview", ticketsToReview.map(ticket => ticket.id));

    for (const ticket of ticketsToReview) {

      console.log("--- ticketsToReview ticket.id", ticket.id);


      let shoudBeEvaluatedByAI = false;

      if (!ticket.conversationIAEvalutaions?.length) {
        shoudBeEvaluatedByAI = true;
      } else {
        const lastEvaluation = ticket.conversationIAEvalutaions[0];
        const lastEvaluationDateTimestamp = Math.floor(lastEvaluation.createdAt.getTime() / 1000);

        shoudBeEvaluatedByAI = ticket.messages.some(m => {
          const messageDate = m.timestamp;
          return messageDate > lastEvaluationDateTimestamp;
        });
      }

      if (shoudBeEvaluatedByAI) {

        await new Promise(resolve => setTimeout(resolve, 10000)); // Esperar 1 segundo para evitar problemas de límite de tasa

        const messagesToEvaluate = ticket.messages.map(m => {
          return {
            id: m.id,
            fromMe: m.fromMe,
            body: m.body,
            mediaType: m.mediaType,
            timestamp: m.timestamp,
            isPrivate: m.isPrivate,
            contact_name: m.fromMe ? null :  m.contact.name,
          }
        })

        const trazaDataToEvaluateRequest = await fetch(
          "https://web.restaurant.pe/trazabilidad/public/rest/cliente/getClienteLicenciaById/" + ticket.contact.traza_clientelicencia_id,
        );

        const trazaDataToEvaluate = (await trazaDataToEvaluateRequest.json()).datos;

        const firstPrompt = `
          Eres un asistente experto en análisis de conversaciones del área de implementaciónes de la empresa Restaurant.pe. A continuación se te proporciona una conversación grupal en formato JSON entre el equipo del cliente y el equipo de implementación.

          Tu tarea es analizar la conversación que te pasare junto con la data de nuestro sistema de trazabilidad (sistema interno de la empresa que te dará la información actual de la licencia) y a criterio, teniendo en cuenta el manual de los implementadores para responder una serie de preguntas de evaluación.

          Formato de cada mensaje:

          {
            'id': string - id del mensaje en la conversacion,
            'fromMe': boolean - indica si el mensaje fue escrito por nuestro equipo,
            'body': string - cuerpo del mensaje,
            'mediaType': string - tipo de mensaje,
            'timestamp': number - timestamp del mensaje,
            'isPrivate': null | boolean - indica si el mensaje es interno, puede ser del sistema o un comentario interno (null es equivalente a false),
            'contact_name': string - nombre del autor del mensaje (en casos en donde el fromMe sea true, el nombre del que escribió el mensaje se puede encontrar al inicio del mensaje)
          }

          Formato de información obtenida desde trazabilidad:

          {
            'clientelicencia_id:': number - id de la licencia dentro de traza,
            'clientelicencia_localnombre:': string - nombre del negocio,
            'clientelicencia_fecha:': date - fecha en el que se creo la licencia y empezó el proceso de implementacion,
            'clientelicencia_nombrecontacto:': string - nombre del representante de la licencia,
            'clientelicencia_fechaalta:': date - fecha en la cual la licencia espera llegar a estar en alta tanto etapa como estado,
            'contact_name': string - nombre del autor del mensaje (en casos en donde el fromMe sea true, el nombre del que escribió el mensaje se puede encontrar al inicio del mensaje),
            'etapas': un array que contiene datos de la licencia en donde tienes que fijarte las fechas de inicio y fin y siguiendo el orden proporciaonado en el archivo
          }

          Para cada pregunta, debes:

          - Evaluar si hay suficiente información en la conversación para dar una respuesta clara. Debes de tener motivos suficientes y validos, apegados a los temas mencionados en el manual.
          - Si sí, responde la pregunta con un numero entre el 0-5 en donde 0 es un no rotundo y el 5 un sí definitivo, y justifica tu respuesta.
          - Si no hay suficiente información, responde la pregunta con null y deja 'justificacion' como null.

          Tu salida debe ser en formato JSON con este esquema por cada pregunta:

          {
            'id': '1',
            'pregunta': '¿El cliente está cumpliendo el flujo esperado?',
            'respuesta': '...',
            'justificacion': '...',
          }

          Evalúa las siguientes preguntas:

          [
            {
                'id': 1,
                'pregunta': '¿El cliente está cumpliendo el flujo esperado?'
            },
            {
                'id': 2,
                'pregunta': '¿El equipo de implementación está respondiendo a tiempo y de manera clara?'
            },
            {
                'id': 3,
                'pregunta': '¿Se evidencia retraso o inactividad por parte del cliente o del equipo?'
            },
            {
                'id': 4,
                'pregunta': '¿La coordinadora mantiene el protocolo de comunicación profesional y cordial?'
            },
            {
                'id': 5,
                'pregunta': '¿Se esta presentando algún tipo de problema? (Ej. instalación, facturación, lentitud, fallas técnicas)'
            },
          ]

          Aquí está la conversación en formato JSON:

          ${JSON.stringify(messagesToEvaluate)}

          Aquí está la información de trazabilidad en formato JSON:

          ${JSON.stringify(trazaDataToEvaluate)}

          Ultimas consideraciones a tener en cuenta:

          - Fijate bien en los timestamps de los mensajes ya que nuestro horario de atencion es de lunes a sabado de 8 a 1 pm y de 3 a 6 pm hora Perú, ten muy en cuenta en las respuestas la diferencia entre el horario de atención y el horario del cliente, ya que si el cliente escribe fuera del horario de atención, no se le puede exigir una respuesta inmediata.
          - Nos importa mucho saber el tiempo de respuesta del cliente y también del equipo de implementación, es algo importante que tienes que tener en cuenta en las respuestas. El proceso de implementacion es un proceso en el cual el tiempo vale oro, asi que es importante que el cliente cumpla con los tiempos establecidos y que el equipo de implementación responda a tiempo.
          - Cuando te toque mencionar a personas, encierra sus nombres entre asteriscos y se muy tajante con los comentarios.
          - Ve directo al grano y no des muchas vueltas en la justificación, sé claro y conciso en tus respuestas, con datos claros.
          - Toma mucho en consideracion el tiempo de inicio y fin de las etapas de la licencia, ya que si el cliente no cumple con los tiempos establecidos, es un problema que tenemos que resolver. Las etapas son muy importantes a tener en cuenta y estan detalladas en el archivo adjunto.

          Devuelve un array JSON de resultados, uno por cada pregunta. No expliques fuera del JSON.
        `;

        console.log("--- ticketsToReview ticket.id antes de 1 promt", ticket.id);


        const firstIARequest = await fetch(
          "https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
              "model": "gpt-4.1",
              "messages": [
                {
                  "role": "user",
                  "content": [
                    {
                      "type": "file",
                      "file": {
                        "file_id": "file-17cqCSyr9zDTfcahD9Qzzp"
                      }
                    },
                    {
                      "type": "text",
                      "text": firstPrompt
                    }
                  ]
                }
              ]
            })
          }
        );

        if (!firstIARequest.ok) {
          throw new Error("Error en la petición a OpenAI: " + firstIARequest.statusText);
        }

        const firstIAResponse = await firstIARequest.json();

        const firstIAResponseData = JSON.parse(firstIAResponse.choices[0].message.content);

        console.log("--- ticketsToReview ticket.id despues de 1 promt", ticket.id);

        // console.log("--- firstIAResponseData", JSON.stringify(firstIAResponseData)) ;

        const secondPrompt = `
          Eres un asistente experto en análisis de conversaciones del área de implementaciones de la empresa Restaurant.pe. A continuación, se te proporciona:

          1. Un consolidado de evaluación basado en una conversación grupal entre el equipo del cliente y el equipo de implementación.
          2. Información adicional obtenida desde el sistema de trazabilidad.

          Tu tarea es analizar toda esta información y, **solo si hay suficientes elementos válidos y claros**, clasificar el caso en una de las siguientes tres categorías:

          [
            {
              'id': '24',
              'nombre': 'Cliente que sigue el flujo de implementación',
              'pautas': [
                'Recibe respuestas rápidas y completas.',
                'Se coordina bien con la agenda.',
                'Agradece o confirma pasos.',
                'Las reuniones se programan sin retrasos mayores.'
              ]
            },
            {
              'id': '23',
              'nombre': 'Cliente con problemas',
              'pautas': [
                'Excede el tiempo esperado para onboarding o inspección.',
                'La coordinadora responde con demora o no cierra acuerdos.',
                'El cliente expresa molestia o confusión.',
                'Hay mensajes duplicados, sin respuestas o falta de seguimiento.'
              ]
            },
            {
              'id': '10',
              'nombre': 'Cliente de alta con problemas',
              'pautas': [
                'El cliente ya completó la instalación o está vendiendo.',
                'Sigue reportando errores técnicos u operativos.',
                'La coordinadora demora en responder o no soluciona adecuadamente.',
                'Se evidencian fallas persistentes sin resolución clara.'
              ]
            }
          ]

          **Muy importante**:

          - **Debes considerar la etapa actual de la licencia y su historial de etapas completas**. Evalúa si el cliente está avanzando conforme a los tiempos estimados o si hay retrasos en alguna etapa del proceso. Las etapas son fundamentales para entender en qué parte del flujo se encuentra el cliente y si está cumpliendo con lo esperado.
          - Si el consolidado contiene respuestas en \`null\`, o si no hay evidencia clara y suficiente en la conversación y trazabilidad, **NO clasifiques el caso**. En ese caso, responde con \`null\` tanto en la categoría como en la justificación.
          - No adivines ni completes vacíos. Clasifica solo si hay fundamento claro y justificado con base en los criterios establecidos.
          - Considera los horarios de atención (lunes a sábado, 8:00 a 13:00 y 15:00 a 18:00, hora Perú), así como los tiempos de respuesta y el cumplimiento de pasos por parte del cliente y el equipo.
          - Si mencionas a personas, encierra sus nombres entre asteriscos (*nombre*). Usa un lenguaje claro, profesional y directo.
          - No olvides siempre tener muy presente el documento subido ya que es el manual base de todos los implementadores y es la guía que debes seguir para clasificar correctamente.

          Tu salida debe estar en este formato JSON:

          {
            'clasificacion': {
              'id': '2',
              'nombre': 'Cliente con problemas'
            },
            'justificacion': '...'
          }

          Si no hay suficiente información para clasificar:

          {
            'clasificacion': null,
            'justificacion': '...'
          }

          Aquí está el consolidado de preguntas:

          ${JSON.stringify(firstIAResponseData)}

          Aquí está la información de trazabilidad en formato JSON:

          ${JSON.stringify(trazaDataToEvaluate)}

          No escribas nada fuera del JSON de salida.
        `;

        await new Promise(resolve => setTimeout(resolve, 10000)); // Esperar 1 segundo para evitar problemas de límite de tasa

        const secondIARequest = await fetch(
          "https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
              "model": "gpt-4.1",
              "messages": [
                {
                  "role": "user",
                  "content": secondPrompt
                }
              ]
            })
          }
        );

        if (!secondIARequest.ok) {
          throw new Error("Error en la petición a OpenAI: " + secondIARequest.statusText);
        }

        const secondIAResponse = await secondIARequest.json();

        console.log("--- ticketsToReview ticket.id despues de 2 promt", ticket.id);

        const secondIAResponseData = JSON.parse(secondIAResponse.choices[0].message.content);

        // console.log("--- secondIAResponseData", JSON.stringify(secondIAResponseData));

        await ConversationIAEvalutaion.create({
          ticketId: ticket.id,
          evaluationType: "implementation_area_groups_categorization",
          resultOne: JSON.stringify(firstIAResponseData),
          resultTwo: JSON.stringify(secondIAResponseData)
        })

        if (secondIAResponseData.clasificacion) {
          await UpdateTicketService({
            ticketData: {
              categoriesIds: [secondIAResponseData.clasificacion.id],
              categorizedByAI: true,
            },
            ticketId: ticket.id
          });
        }

        await new Promise(resolve => setTimeout(resolve, 10000)); // Esperar 1 segundo para evitar problemas de límite de tasa
      }


    }

  } catch (error) {
    console.log(" ------ Error in searchForImplementationAreaGroupsTickets ------", error);
    Sentry.captureException(error);
  }
});

