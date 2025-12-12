import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import { emitEvent } from "../../libs/emitEvent";

interface Request {
  ticketId: number;
}

/**
 * SyncClientTicketsService
 * 
 * Sincroniza todos los tickets de un mismo cliente (mismo contact.number)
 * cuando se actualiza uno de ellos. Esto asegura que si un cliente individual
 * tiene múltiples tickets (múltiples conexiones), todos se mantengan en el mismo estado.
 * 
 * Ejemplo: Si Mili (51992100780) tiene 3 tickets (3 conexiones) y le respondes
 * en uno de ellos, los otros 2 también deben pasar a "En proceso".
 */
const SyncClientTicketsService = async ({
  ticketId
}: Request): Promise<void> => {

  // 1. Obtener el ticket que se acaba de actualizar
  const updatedTicket = await Ticket.findOne({
    where: { id: ticketId },
    include: [
      {
        model: Contact,
        as: "contact",
        attributes: ["id", "name", "number", "isGroup"]
      }
    ]
  });

  if (!updatedTicket) {
    console.log(`[SyncClientTickets] Ticket ${ticketId} no encontrado`);
    return;
  }

  // 2. Solo sincronizar si es un contacto individual (no grupos)
  // Los grupos ya están sincronizados por contactId de forma natural
  if (updatedTicket.contact?.isGroup) {
    console.log(`[SyncClientTickets] Ticket ${ticketId} es un grupo, no se sincroniza`);
    return;
  }

  const clientNumber = updatedTicket.contact?.number;
  if (!clientNumber) {
    console.log(`[SyncClientTickets] Ticket ${ticketId} no tiene número de contacto`);
    return;
  }

  // 3. VERIFICACIÓN RÁPIDA: ¿Hay otros tickets del mismo cliente?
  // Esto evita queries pesadas si el cliente solo tiene 1 ticket
  const Op = require('sequelize').Op;
  const ticketCount = await Ticket.count({
    where: { 
      id: { [Op.ne]: ticketId },
      status: { [Op.in]: ['open', 'pending'] } // Solo tickets activos
    },
    include: [
      {
        model: Contact,
        as: "contact",
        where: {
          number: clientNumber,
          isGroup: false
        },
        attributes: []
      }
    ]
  });

  if (ticketCount === 0) {
    console.log(`[SyncClientTickets] Cliente ${clientNumber} solo tiene 1 ticket, no se sincroniza`);
    return;
  }

  console.log(`[SyncClientTickets] Cliente ${clientNumber} tiene ${ticketCount + 1} tickets, sincronizando...`);

  // 4. Buscar todos los otros tickets del mismo cliente
  const allClientTickets = await Ticket.findAll({
    where: { 
      id: { [Op.ne]: ticketId },
      status: { [Op.in]: ['open', 'pending'] } // Solo tickets activos
    },
    include: [
      {
        model: Contact,
        as: "contact",
        where: {
          number: clientNumber,
          isGroup: false
        },
        attributes: ["id", "name", "number", "isGroup"]
      }
    ]
  });

  console.log(`[SyncClientTickets] Sincronizando ${allClientTickets.length} tickets del cliente ${clientNumber}`);

  // 5. Actualizar todos los otros tickets con el mismo estado
  const fieldsToSync = {
    status: updatedTicket.status,
    userId: updatedTicket.userId,
    queueId: updatedTicket.queueId,
    beenWaitingSinceTimestamp: updatedTicket.beenWaitingSinceTimestamp,
  };

  // 6. Actualizar cada ticket y emitir evento socket
  for (const ticket of allClientTickets) {
    await ticket.update(fieldsToSync);

    // Emitir evento socket para actualizar la UI en tiempo real
    emitEvent({
      to: [ticket.status, "notification", ticket.id.toString()],
      event: {
        name: "ticket",
        data: {
          action: "update",
          ticket
        }
      }
    });

    console.log(`[SyncClientTickets] Ticket ${ticket.id} sincronizado con estado: ${fieldsToSync.status}`);
  }

  console.log(`[SyncClientTickets] ✅ Sincronización completada para cliente ${clientNumber}`);
};

export default SyncClientTicketsService;
