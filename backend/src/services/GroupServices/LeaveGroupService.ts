import { GroupChat } from "whatsapp-web.js";
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

  // 4. Obtener el bot de WhatsApp
  const wbot = await GetTicketWbot(ticket);

  // 5. Obtener el chat del grupo
  const wbotChat = await wbot.getChatById(
    `${ticket.contact?.number}@${ticket.isGroup ? "g" : "c"}.us`
  );

  const wbotGroupChat = wbotChat as GroupChat;

  // 6. Salir del grupo
  await wbotGroupChat.leave();

  // 7. Actualizar el ticket a cerrado
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
