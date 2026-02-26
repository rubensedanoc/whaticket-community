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

/**
 * Normaliza un string eliminando tildes, acentos y caracteres especiales
 * para hacer comparaciones insensibles a estos caracteres.
 * Ejemplo: "Administración" → "administracion"
 */
const normalizeString = (str: string): string => {
  return str
    .normalize("NFD") // Descompone caracteres con acentos (é → e + ´)
    .replace(/[\u0300-\u036f]/g, "") // Elimina los diacríticos (acentos, tildes)
    .toLowerCase()
    .trim();
};

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

    // Normalizar el nombre de búsqueda eliminando tildes y acentos
    const normalizedSearchName = normalizeString(groupName);

    // Obtener todos los grupos para hacer comparación normalizada
    const allGroups = await Contact.findAll({
      where: {
        isGroup: true
      }
    });

    // Filtrar grupos coincidentes con normalización
    // Primero buscar coincidencia exacta
    let matchingGroups = allGroups.filter(group => 
      normalizeString(group.name) === normalizedSearchName
    );

    // Si no hay coincidencia exacta, buscar grupos que contengan el término
    if (matchingGroups.length === 0) {
      matchingGroups = allGroups
        .filter(group => 
          normalizeString(group.name).includes(normalizedSearchName)
        )
        .sort((a, b) => a.name.length - b.name.length) // Ordenar por longitud
        .slice(0, 10); // Limitar a 10 resultados
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
