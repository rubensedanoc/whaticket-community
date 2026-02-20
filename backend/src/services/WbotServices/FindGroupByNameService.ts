import { Op } from "sequelize";
import Sequelize from "sequelize";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";

interface Request {
  groupName: string;
  whatsappId: number;
}

interface ServiceResponse {
  success: boolean;
  data?: Array<{
    ticketId: number;
    groupName: string;
    groupNumber: string;
    contactId: number;
  }>;
  error?: string;
  message?: string;
}

const FindGroupByNameService = async ({
  groupName,
  whatsappId
}: Request): Promise<ServiceResponse> => {
  try {
    const whatsapp = await Whatsapp.findByPk(whatsappId);
    
    if (!whatsapp) {
      return {
        success: false,
        error: "WHATSAPP_NOT_FOUND",
        message: `No se encontró la conexión de WhatsApp con ID ${whatsappId}`
      };
    }

    const validStatuses = ["CONNECTED", "PAIRING", "OPENING"];
    if (!validStatuses.includes(whatsapp.status)) {
      return {
        success: false,
        error: "WHATSAPP_DISCONNECTED",
        message: `La conexión de WhatsApp ID ${whatsappId} no está activa. Estado actual: ${whatsapp.status}`
      };
    }

    const searchName = groupName.trim().toLowerCase();

    let matchingGroups = await Contact.findAll({
      where: {
        isGroup: true,
        [Op.and]: [
          Sequelize.where(
            Sequelize.fn("LOWER", Sequelize.col("name")),
            searchName
          )
        ]
      }
    });

    if (matchingGroups.length === 0) {
      matchingGroups = await Contact.findAll({
        where: {
          isGroup: true,
          [Op.and]: [
            Sequelize.where(
              Sequelize.fn("LOWER", Sequelize.col("name")),
              "LIKE",
              `%${searchName}%`
            )
          ]
        },
        limit: 10,
        order: [
          [Sequelize.literal(`CHAR_LENGTH(name)`), "ASC"]
        ]
      });
    }

    if (matchingGroups.length === 0) {
      return {
        success: false,
        error: "GROUP_NOT_FOUND",
        message: `No se encontró ningún grupo con el nombre '${groupName}'`
      };
    }

    const results = [];

    for (const groupContact of matchingGroups) {
      try {
        const ticket = await FindOrCreateTicketService({
          contact: groupContact,
          whatsappId: whatsappId,
          unreadMessages: 0,
          groupContact: groupContact
        });

        results.push({
          ticketId: ticket.id,
          groupName: groupContact.name,
          groupNumber: groupContact.number,
          contactId: groupContact.id
        });
      } catch (error) {
        // Error silencioso al crear ticket
      }
    }

    return {
      success: true,
      data: results
    };

  } catch (error) {
    return {
      success: false,
      error: "INTERNAL_ERROR",
      message: `Error al buscar grupo: ${error.message}`
    };
  }
};

export default FindGroupByNameService;
