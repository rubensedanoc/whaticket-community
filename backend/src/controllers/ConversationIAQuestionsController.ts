import { Request, Response } from "express";
import * as Yup from "yup";

import CreateQuickAnswerService from "../services/QuickAnswerService/CreateQuickAnswerService";
import DeleteQuickAnswerService from "../services/QuickAnswerService/DeleteQuickAnswerService";
import ListQuickAnswerService from "../services/QuickAnswerService/ListQuickAnswerService";
import ShowQuickAnswerService from "../services/QuickAnswerService/ShowQuickAnswerService";
import UpdateQuickAnswerService from "../services/QuickAnswerService/UpdateQuickAnswerService";

import AppError from "../errors/AppError";
import { emitEvent } from "../libs/emitEvent";
import Queue from "../models/Queue";
import User from "../models/User";
import ConversationIAQuestions from "../models/ConversationIAQuestions";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import Message from "../models/Message";
import Contact from "../models/Contact";
import { Op } from "sequelize";
import Ticket from "../models/Ticket";
import Whatsapp from "../models/Whatsapp";

type IndexQuery = {
  ticketId: string;
};

interface StoreQuery {
  ticketId: number;
  question: {
    text: string;
  };
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const {
    ticketId: ticketIdAsString,
  } = req.query as IndexQuery;

  const ticketId = Number(ticketIdAsString);

  const conversationIAQuestions = await ConversationIAQuestions.findAll({
    where: {
      ticketId
    }
  });

  return res.json({ data: conversationIAQuestions });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId, question }: StoreQuery = req.body;
  const userId = req.user.id;

  const ticket = await ShowTicketService(ticketId);

  // if (!ticket.contact?.contactClientelicencias || ticket.contact?.contactClientelicencias?.length === 0) {
  //   throw new AppError("No hay licencias de cliente para este ticket.", 400);
  // }

  if (!ticket.conversationIAEvalutaions || ticket.conversationIAEvalutaions.length === 0) {
    throw new AppError("No hay evaluaciones de IA para este ticket.", 400);
  }

  const lastIAResponseData = ticket.conversationIAEvalutaions[0].resultOne;

  const ticketsToGetMessages = await Ticket.findAll({
  where: {
    whatsappId: ticket.whatsappId,
    contactId: ticket.contactId
  },
  include: [
      { model: Contact, as: "contact", attributes: ["id", "name", "number", "createdAt"] },
      { model: Whatsapp, as: "whatsapp", attributes: ["id", "name", "number"] },
  ],
});

  const ticketMessages = await Message.findAll({
    attributes: ["id", "body", "timestamp", "fromMe", "mediaType", "isPrivate"],
    order: [["timestamp", "ASC"]],
    include: [{
      model: Contact,
      as: "contact",
      attributes: ["id", "name", "isCompanyMember"],
    }],
    where: {
      ticketId: {
        [Op.in]: ticketsToGetMessages.map(ticket => ticket.id)
      }
    },
  });

  const messagesToEvaluate = ticketMessages.map(m => {
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


  const licenseToEvaluate = ticket?.contact?.contactClientelicencias?.length > 0 ? ticket?.contact?.contactClientelicencias[0] : null;
  let trazaDataToEvaluate = null;

  if (licenseToEvaluate) {
    const trazaDataToEvaluateRequest = await fetch(
      "https://web.restaurant.pe/trazabilidad/public/rest/cliente/getClienteLicenciaById/" + licenseToEvaluate.traza_clientelicencia_id,
    );

    trazaDataToEvaluate = (await trazaDataToEvaluateRequest.json()).datos;
  }

  const response = {
    text: "Sin respuesta",
  };

  const prompt = `
    Eres un asistente experto en análisis de conversaciones del área de implementaciones de la empresa Restaurant.pe. A continuación, se te proporciona:

    2. Toda la conversacion del ticket, incluyendo mensajes del cliente y del equipo de implementación.
    1. Un consolidado de evaluación basado en un analisis previo de la conversacion.
    2. Información adicional obtenida desde el sistema de trazabilidad.
    3. Una pregunta hecha por un implementador que necesita informacion.

    Tu tarea es analizar toda esta información y responder a la pregunta.

    **Muy importante**:

    - **Debes considerar la etapa actual de la licencia y su historial de etapas completas**. Evalúa si el cliente está avanzando conforme a los tiempos estimados o si hay retrasos en alguna etapa del proceso. Las etapas son fundamentales para entender en qué parte del flujo se encuentra el cliente y si está cumpliendo con lo esperado.
    - Considera los horarios de atención (lunes a sábado, 8:00 a 13:00 y 15:00 a 18:00, hora Perú), así como los tiempos de respuesta y el cumplimiento de pasos por parte del cliente y el equipo.
    - Si mencionas a personas, encierra sus nombres entre asteriscos (*nombre*). Usa un lenguaje claro, profesional y directo.
    - No olvides siempre tener muy presente el documento subido ya que es el manual base de todos los implementadores y es la guía que debes seguir para clasificar correctamente.
    - Si la pregunta no tiene suficiente información coherente o no esta relacionada con toda la informacion proporcionada, respondela con 'Pregunta no valida'.

    Tu salida debe estar en este formato JSON:

    {
      'text': '...',
    }

    Aquí está la conversación en formato JSON:

    ${JSON.stringify(messagesToEvaluate)}

    Aquí está el consolidado de preguntas:

    ${JSON.stringify(lastIAResponseData)}

    ${trazaDataToEvaluate ? `
      Aquí está la información de trazabilidad en formato JSON:

      ${JSON.stringify(trazaDataToEvaluate)}
    ` : "No existe data de trazabilidad para esta conversación."}

    Aquí está la pregunta del implementador:

    ${JSON.stringify(question.text)}

    No escribas nada fuera del JSON de salida.
  `;

  const IARequest = await fetch(
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
                  "file_id": "file-JgfAgvp3Fm9zZUV1Qnr3Ht"
                }
              },
              {
                "type": "text",
                "text": prompt
              }
            ]
          }
        ]
      })
    }
  );

  if (!IARequest.ok) {
    throw new Error("Error en la petición a OpenAI: " + IARequest.statusText);
  }

  const IAResponse = await IARequest.json();

  const IAResponseData = JSON.parse(IAResponse.choices[0].message.content);

  response.text = IAResponseData?.text || "Error en la respuesta de openia.";

  const newConversationIAQuestion = await ConversationIAQuestions.create({
    ticketId,
    userId,
    question: JSON.stringify(question),
    response: JSON.stringify(response),
  });

  newConversationIAQuestion.user = await User.findByPk(newConversationIAQuestion.userId, {
    attributes: ["id", "name"],
  });

  return res.status(200).json(newConversationIAQuestion);
};
