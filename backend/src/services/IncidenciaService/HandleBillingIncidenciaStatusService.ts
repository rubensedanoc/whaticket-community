import * as Sentry from "@sentry/node";
import { Op } from "sequelize";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Whatsapp from "../../models/Whatsapp";
import { MetaApiClient } from "../../clients/MetaApiClient";
import { emitEvent } from "../../libs/emitEvent";
import { getIncidenciaResetFields } from "../ChatbotMessageService/IncidenciaFlowHelper";

interface HandleBillingStatusParams {
  incidenciaId: string;
  estado: string;
}

interface HandleBillingStatusResult {
  success: boolean;
  ticketId?: number;
  message: string;
}

/**
 * Maneja notificaciones desde el sistema Billing cuando una incidencia
 * cambia de estado (RESUELTO, CLOSED, etc.).
 *
 * Busca el ticket activo con ese incidenciaExternalId, envía mensaje
 * de cierre al cliente, y cierra el ticket.
 */
const HandleBillingIncidenciaStatusService = async ({
  incidenciaId,
  estado
}: HandleBillingStatusParams): Promise<HandleBillingStatusResult> => {
  const normalizedEstado = estado.toUpperCase().trim();

  // Solo procesar estados de cierre/resolución
  const closingStates = ["RESUELTO", "CLOSED", "CERRADO", "SOLUCIONADO"];
  if (!closingStates.includes(normalizedEstado)) {
    console.log(`[HandleBillingIncidenciaStatus] Estado "${estado}" no es de cierre, ignorando`);
    return { success: true, message: `Estado "${estado}" ignorado (no es cierre)` };
  }

  // Buscar ticket activo con esa incidencia
  const ticket = await Ticket.findOne({
    where: {
      incidenciaExternalId: incidenciaId,
      incidenciaStatus: "completed",
      status: { [Op.in]: ["open", "pending"] }
    },
    include: [
      { model: Contact, as: "contact", required: true },
      { model: Whatsapp, as: "whatsapp", required: true }
    ]
  });

  if (!ticket) {
    console.log(`[HandleBillingIncidenciaStatus] No se encontró ticket activo para incidencia ${incidenciaId}`);
    return { success: false, message: `No se encontró ticket activo para incidencia ${incidenciaId}` };
  }

  const contact = ticket.contact as Contact;
  const whatsapp = ticket.whatsapp as Whatsapp;

  console.log(`[HandleBillingIncidenciaStatus] Procesando cierre de incidencia ${incidenciaId} para ticket ${ticket.id}`);

  // Enviar mensaje de cierre al cliente
  try {
    const client = new MetaApiClient({
      phoneNumberId: whatsapp.phoneNumberId,
      accessToken: whatsapp.metaAccessToken
    });

    const closureBody = "✅ Tu solicitud fue atendida y cerrada por nuestro equipo de soporte.\nSi aún necesitas ayuda puedes indicarlo.";
    const closureResp = await client.sendText({ to: contact.number, body: closureBody });
    const closureMsg = await Message.create({
      id: closureResp.messages[0].id,
      ticketId: ticket.id,
      contactId: contact.id,
      body: closureBody,
      fromMe: true,
      mediaType: "chat",
      read: true,
      quotedMsgId: null,
      timestamp: Math.floor(Date.now() / 1000),
      ack: 3
    });
    emitEvent({
      to: [ticket.id.toString(), ticket.status],
      event: { name: "appMessage", data: { action: "create", message: closureMsg, ticket, contact } }
    });
  } catch (err: any) {
    console.error(`[HandleBillingIncidenciaStatus] Error enviando mensaje de cierre:`, err.message);
    Sentry.captureException(err, {
      extra: { ticketId: ticket.id, incidenciaId }
    });
  }

  // Cerrar ticket y limpiar estado
  const oldStatus = ticket.status;
  await ticket.update({
    ...getIncidenciaResetFields(),
    chatbotMessageIdentifier: null,
    chatbotMessageLastStep: null,
    chatbotFinishedAt: new Date(),
    chatbotSelectedCategory: null,
    status: "closed"
  });

  emitEvent({
    to: [oldStatus],
    event: { name: "ticket", data: { action: "delete", ticketId: ticket.id } }
  });
  emitEvent({
    to: ["closed", "notification", ticket.id.toString()],
    event: { name: "ticket", data: { action: "update", ticket } }
  });

  console.log(`[HandleBillingIncidenciaStatus] Ticket ${ticket.id} cerrado por notificación de Billing (incidencia ${incidenciaId} → ${estado})`);

  return { success: true, ticketId: ticket.id, message: `Ticket ${ticket.id} cerrado exitosamente` };
};

export default HandleBillingIncidenciaStatusService;
