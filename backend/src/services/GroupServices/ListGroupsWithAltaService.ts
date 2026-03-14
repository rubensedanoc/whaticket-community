import { Op } from "sequelize";
import { differenceInDays } from "date-fns";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";

interface Request {
  whatsappId?: number;
  clientelicenciaEtapaId?: number; // Default: 5 (ALTA)
}

interface GroupWithAlta {
  ticketId: number;
  groupName: string;
  contactNumber: string;
  whatsappId: number;
  status: string;
  ticketCreatedAt: Date;
  daysOld: number;
  etapaId: number;
  etapaAltaAssignedAt: Date | null;
  daysInAlta: number | null;
}

interface Response {
  groups: GroupWithAlta[];
  count: number;
}

const ListGroupsWithAltaService = async ({
  whatsappId,
  clientelicenciaEtapaId = 5 // 5 = ALTA por defecto
}: Request): Promise<Response> => {
  const whereCondition: any = {
    isGroup: true,
    status: {
      [Op.in]: ["pending", "open"]
    },
    "$contact.traza_clientelicencia_currentetapaid$": clientelicenciaEtapaId
  };

  if (whatsappId) {
    whereCondition.whatsappId = whatsappId;
  }

  const tickets = await Ticket.findAll({
    where: whereCondition,
    attributes: ["id", "whatsappId", "status", "createdAt", "etapa_alta_assigned_at"],
    include: [
      {
        model: Contact,
        as: "contact",
        attributes: ["id", "name", "number", "traza_clientelicencia_currentetapaid"],
        required: true
      },
      {
        model: Whatsapp,
        as: "whatsapp",
        attributes: ["id", "name"]
      }
    ],
    order: [["createdAt", "ASC"]]
  });

  const groups: GroupWithAlta[] = tickets.map((ticket: any) => {
    // Calcular días desde que se creó el ticket
    const daysOld = differenceInDays(new Date(), new Date(ticket.createdAt));

    // Calcular días en ALTA si existe la fecha de asignación en el ticket
    const etapaAltaAssignedAt = ticket.etapa_alta_assigned_at;
    const daysInAlta = etapaAltaAssignedAt 
      ? differenceInDays(new Date(), new Date(etapaAltaAssignedAt))
      : null;

    return {
      ticketId: ticket.id,
      groupName: ticket.contact.name,
      contactNumber: ticket.contact.number,
      whatsappId: ticket.whatsappId,
      status: ticket.status,
      ticketCreatedAt: ticket.createdAt,
      daysOld: daysOld,
      etapaId: ticket.contact.traza_clientelicencia_currentetapaid,
      etapaAltaAssignedAt: etapaAltaAssignedAt,
      daysInAlta: daysInAlta
    };
  });

  // Ordenar por daysInAlta DESC (más antiguos primero), luego por daysOld
  groups.sort((a, b) => {
    if (a.daysInAlta !== null && b.daysInAlta !== null) {
      return b.daysInAlta - a.daysInAlta;
    }
    if (a.daysInAlta !== null) return -1;
    if (b.daysInAlta !== null) return 1;
    return b.daysOld - a.daysOld;
  });

  return {
    groups,
    count: groups.length
  };
};

export default ListGroupsWithAltaService;
