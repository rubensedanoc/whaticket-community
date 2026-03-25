import { GroupChat } from "whatsapp-web.js";
import { differenceInDays } from "date-fns";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import ShowTicketService from "../TicketServices/ShowTicketService";
import UpdateTicketService from "../TicketServices/UpdateTicketService";

interface Request {
  ticketId: number;
  userId: number;
  addNote?: boolean;
}

interface Response {
  success: boolean;
  message: string;
  ticketId: number;
}

const LeaveGroupService = async ({
  ticketId,
  userId,
  addNote = false
}: Request): Promise<Response> => {
  // 1. Obtener el ticket
  const ticket = await ShowTicketService(ticketId);

  // 2. Validar que sea un grupo
  if (!ticket.isGroup) {
    throw new AppError("Este ticket no es un grupo", 400);
  }

  // 3. Validar que el ticket no esté cerrado
  if (ticket.status === "closed") {
    throw new AppError("Este ticket ya está cerrado", 400);
  }

  // 4. Validar que el contacto esté en etapa ALTA (ID = 5)
  if (ticket.contact?.traza_clientelicencia_currentetapaid !== 5) {
    throw new AppError("El grupo no está en etapa ALTA", 400);
  }

  // 5. Validar que tenga fecha de asignación a ALTA
  if (!ticket.etapa_alta_assigned_at) {
    throw new AppError("El grupo no tiene fecha de asignación a ALTA", 400);
  }

  // 6. Validar que tenga al menos 15 días en ALTA
  const daysInAlta = differenceInDays(
    new Date(),
    new Date(ticket.etapa_alta_assigned_at)
  );

  if (daysInAlta < 15) {
    throw new AppError(
      `El grupo debe tener al menos 15 días en ALTA. Actualmente tiene ${daysInAlta} días`,
      400
    );
  }

  // 7. Obtener el bot de WhatsApp
  const wbot = await GetTicketWbot(ticket);

  // 8. Obtener el chat del grupo
  const wbotChat = await wbot.getChatById(
    `${ticket.contact?.number}@${ticket.isGroup ? "g" : "c"}.us`
  );

  const wbotGroupChat = wbotChat as GroupChat;

  // 9. Salir del grupo
  await wbotGroupChat.leave();

  // 10. Actualizar el ticket a cerrado
  await UpdateTicketService({
    ticketId: ticket.id,
    ticketData: {
      status: "closed",
      userId: userId
    }
  });

  return {
    success: true,
    message: "Se ha salido del grupo exitosamente",
    ticketId: ticket.id
  };
};

export default LeaveGroupService;
