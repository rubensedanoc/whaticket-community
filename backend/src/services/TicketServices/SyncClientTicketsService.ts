import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
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

  // 3. NO sincronizar si es un miembro de la empresa (agente/empleado)
  // Los agentes tienen cientos de tickets y NO deben sincronizarse entre sí
  if (updatedTicket.contact?.isCompanyMember) {
    console.log(`[SyncClientTickets] Ticket ${ticketId} es de un agente/empleado, no se sincroniza`);
    return;
  }

  const clientNumber = updatedTicket.contact?.number;
  if (!clientNumber) {
    console.log(`[SyncClientTickets] Ticket ${ticketId} no tiene número de contacto`);
    return;
  }

  // 4. NO sincronizar si el número es una CONEXIÓN de WhatsApp de la empresa
  // Las conexiones (ej: Área de Facturación, Vanessa PROPIO) tienen cientos de tickets
  // y cada ticket es de un cliente diferente, NO deben sincronizarse entre sí
  const isWhatsappConnection = await Whatsapp.findOne({
    where: { number: clientNumber }
  });

  if (isWhatsappConnection) {
    console.log(`[SyncClientTickets] Ticket ${ticketId} es de una conexión WhatsApp (${isWhatsappConnection.name}), no se sincroniza`);
    return;
  }

  // 4. VERIFICACIÓN RÁPIDA: ¿Hay otros tickets del mismo cliente?
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
          isGroup: false,
          [Op.or]: [
            { isCompanyMember: false },
            { isCompanyMember: null }
          ]
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

  // 5. Buscar todos los otros tickets del mismo cliente
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
          isGroup: false,
          [Op.or]: [
            { isCompanyMember: false },
            { isCompanyMember: null }
          ]
        },
        attributes: ["id", "name", "number", "isGroup"]
      }
    ]
  });

  console.log(`[SyncClientTickets] Sincronizando ${allClientTickets.length} tickets del cliente ${clientNumber}`);

  // 6. Actualizar todos los otros tickets con el mismo estado
  const fieldsToSync = {
    status: updatedTicket.status,
    userId: updatedTicket.userId,
    queueId: updatedTicket.queueId,
    beenWaitingSinceTimestamp: updatedTicket.beenWaitingSinceTimestamp,
  };

  // 7. Actualizar cada ticket silenciosamente (SIN emitir eventos)
  // IMPORTANTE: NO emitimos eventos socket aquí porque el ticket primario
  // ya emitió su evento en UpdateTicketService. Emitir eventos aquí causa
  // que el frontend cuente mal (decrementa 3 veces cuando debería ser 1).
  for (const ticket of allClientTickets) {
    const oldStatus = ticket.status;
    await ticket.update(fieldsToSync);

    console.log(`[SyncClientTickets] Ticket ${ticket.id} sincronizado silenciosamente: ${oldStatus} → ${fieldsToSync.status}`);
  }

  console.log(`[SyncClientTickets] ✅ Sincronización completada para cliente ${clientNumber} (${allClientTickets.length} tickets actualizados)`);
};

export default SyncClientTicketsService;
