import { endOfDay, parseISO, startOfDay } from "date-fns";
import {
  Filterable,
  Includeable,
  Op,
  Sequelize,
  col,
  fn,
  where
} from "sequelize";
import Category from "../../models/Category";
import Contact from "../../models/Contact";
import MarketingCampaign from "../../models/MarketingCampaign";
import Queue from "../../models/Queue";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";
import ContactClientelicencias from "../../models/ContactClientelicencias";

// Define los tipos de grupo de tickets que puedes solicitar
export type TicketGroupType = "no-response" | "in-progress";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  status?: string; // Incluido para coherencia, aunque la lógica del grupo maneja el estado
  showAll?: string; // Incluido por compatibilidad, aunque no se usa en la lógica de grupos
  userId: string;
  whatsappIds: Array<number>;
  queueIds: Array<number>;
  marketingCampaignIds: Array<number>;
  typeIds: Array<string>; // Incluido para compatibilidad
  showOnlyMyGroups: boolean; // Incluido por compatibilidad
  categoryId?: number;
  userWhatsappsId?: number[]; // Llenado internamente
  showOnlyWaitingTickets?: boolean; // Incluido, con su propia lógica
  clientelicenciaEtapaIds?: number[];

  // Nuevo parámetro para especificar el grupo de tickets deseado
  ticketGroupType?: TicketGroupType;
  
  // Parámetro para identificar la vista de origen (general, grouped, etc.)
  viewSource?: string;
}

interface Response {
  tickets: any[];
  count: number;
  hasMore: boolean;
  whereCondition: Filterable["where"];
  includeCondition: Includeable[];
}

// Función auxiliar para calcular el timestamp hace N minutos
const getNMinutesAgo = (minutes: number): number => {
  return (Date.now() - minutes * 60 * 1000) / 1000; // Convertir a segundos
};

// Función para construir la condición where principal
const buildSpecialWhereCondition = ({
  userId,
  searchParam,
  status,
  whatsappIds,
  queueIds,
  marketingCampaignIds,
  typeIds,
  showOnlyMyGroups,
  categoryId,
  userWhatsappsId,
  showOnlyWaitingTickets,
  clientelicenciaEtapaIds,
  ticketGroupType,
  showAll,
  viewSource
}: Request): Filterable["where"] => {

  // ============================================================
  // BLOQUE PREPARADO PARA LÓGICA ESPECÍFICA SEGÚN VIEWSOURCE
  // ============================================================
  // Por ahora, todo usa la misma lógica, pero en el futuro
  // puedes agregar condiciones específicas aquí
  
  // Ejemplo para el futuro:
  // if (viewSource === "grouped") {
  //   // Lógica específica para la vista "Agrupados"
  //   // Por ejemplo: joins adicionales, cálculos especiales, etc.
  // } else if (viewSource === "general") {
  //   // Lógica específica para la vista "General"
  // }
  // ============================================================

  // console.log({
  //   userId,
  //   searchParam,
  //   status,
  //   whatsappIds,
  //   queueIds,
  //   marketingCampaignIds,
  //   typeIds,
  //   showOnlyMyGroups,
  //   categoryId,
  //   userWhatsappsId,
  //   showOnlyWaitingTickets,
  //   clientelicenciaEtapaIds,
  //   ticketGroupType,
  //   showAll,
  //   viewSource
  // });

  let finalCondition: Filterable["where"] = { [Op.and]: [] }; // Inicializamos con Op.and para combinar fácilmente

  const fifteenMinutesAgo = getNMinutesAgo(15);

  // Lógica principal basada en el tipo de grupo solicitado
  if (ticketGroupType === "no-response") {
    (finalCondition[Op.and] as any[]).push({
      [Op.or]: [
        // Condición para chats individuales (pendientes)
        {
          isGroup: false,
          status: { [Op.in]: ["pending"] },
        },
        // Condición para chats individuales (abiertos) con >= 15 min sin respuesta
        {
          isGroup: false,
          status: { [Op.in]: ["open"] },
          beenWaitingSinceTimestamp: { [Op.lte]: fifteenMinutesAgo }
        },
        // Condición para chats grupales con >= 15 min sin respuesta
        {
          isGroup: true,
          status: { [Op.in]: ["open"] },
          beenWaitingSinceTimestamp: { [Op.lte]: fifteenMinutesAgo }
        }
      ]
    });
  } else if (ticketGroupType === "in-progress") {
    (finalCondition[Op.and] as any[]).push({
      [Op.or]: [
        // Condición para chats individuales (abiertos) con < 15 min sin respuesta
        {
          isGroup: false,
          status: { [Op.in]: ["open"] },
          beenWaitingSinceTimestamp: {
            [Op.or]: [
              { [Op.gt]: fifteenMinutesAgo },
              { [Op.is]: null } // Permitir tickets sin beenWaitingSinceTimestamp
            ]
          }
        },
        // Condición para chats grupales con < 15 min sin respuesta
        {
          isGroup: true,
          status: { [Op.in]: ["open"] },
          beenWaitingSinceTimestamp: {
            [Op.or]: [
              { [Op.gt]: fifteenMinutesAgo },
              { [Op.is]: null } // Permitir tickets sin beenWaitingSinceTimestamp
            ]
          }
        }
      ]
    });
  }

  // --- Filtros Generales que se combinan con la lógica de grupo (AND) ---

  // Filtrado por searchParam
  if (searchParam) {
    const sanitizedSearchParam = searchParam.toLowerCase().trim();
    (finalCondition[Op.and] as any[]).push({
      [Op.or]: [
        {
          "$contact.name$": where(
            fn("LOWER", col("contact.name")),
            "LIKE",
            `%${sanitizedSearchParam}%`
          )
        },
        { "$contact.number$": { [Op.like]: `%${sanitizedSearchParam}%` } }
      ]
    });
  }

  // Filtrado por clientelicenciaEtapaIds
  if (clientelicenciaEtapaIds?.length) {
    (finalCondition[Op.and] as any[]).push({
      "$contact.traza_clientelicencia_currentetapaid$": {
        [Op.or]: clientelicenciaEtapaIds.includes(null)
          ? [clientelicenciaEtapaIds.filter(id => id !== null), null]
          : [clientelicenciaEtapaIds]
      }
    });
  }

  // Filtrado por Queue (departamentos)
  if (queueIds?.length) {
    (finalCondition[Op.and] as any[]).push({
      queueId: {
        [Op.or]: queueIds.includes(null)
          ? [queueIds.filter(id => id !== null), null]
          : [queueIds]
      }
    });
  }

  // Filtrado por MarketingCampaign
  if (marketingCampaignIds?.length) {
    (finalCondition[Op.and] as any[]).push({
      marketingCampaignId: {
        [Op.or]: marketingCampaignIds.includes(null)
          ? [marketingCampaignIds.filter(id => id !== null), null]
          : [marketingCampaignIds]
      }
    });
  }

  // Filtrado por Whatsapp
  if (whatsappIds?.length) {
    (finalCondition[Op.and] as any[]).push({
      whatsappId: {
        [Op.or]: whatsappIds
      }
    });
  }

  // Filtrado por CategoryId
  if (categoryId === 0) {
    (finalCondition[Op.and] as any[]).push(
      Sequelize.literal(
        `NOT EXISTS (
          SELECT 1
          FROM \`TicketCategories\`
          WHERE \`TicketCategories\`.\`ticketId\` = \`Ticket\`.\`id\`
        )`
      )
    );
  } else if (categoryId && categoryId > 0) {
    // Si se filtra por una categoría específica, se manejará en el "include"
  }

  // Lógica para showOnlyWaitingTickets (si tiene beenWaitingSinceTimestamp)
  if (showOnlyWaitingTickets) {
    (finalCondition[Op.and] as any[]).push({
      beenWaitingSinceTimestamp: {
        [Op.not]: null
      }
    });
  }

  // Lógica de tipo de ticket (individual/grupo) si es relevante fuera de la lógica de grupo principal
  if (typeIds?.length) {
    (finalCondition[Op.and] as any[]).push({
      isGroup: { [Op.or]: typeIds.map(typeId => typeId === "group") }
    });
  }

  // Lógica para showOnlyMyGroups (principalmente para tickets de grupo donde el usuario es participante)
  if (showOnlyMyGroups && typeIds.includes("group")) {
    (finalCondition[Op.and] as any[]).push({
      "$participantUsers.id$": +userId
    });
  }

  // Si showAll no es "true", y es individual y abierto, aplica filtro de usuario
  if (showAll !== "true" && typeIds[0] === "individual" && status === "open") {
    (finalCondition[Op.and] as any[]).push({
      [Op.or]: [
        { userId },
        {
          id: {
            [Op.in]: Sequelize.literal(
              `(SELECT \`ticketId\` FROM \`TicketHelpUsers\` WHERE \`userId\` = ${userId})`
            )
          }
        },
        ...(searchParam && userWhatsappsId && userWhatsappsId.length > 0
          ? [
              {
                whatsappId: {
                  [Op.in]: userWhatsappsId
                }
              }
            ]
          : [])
      ]
    });
  }

  // Si al final no hay ninguna condición significativa, devolvemos un objeto vacío para no filtrar por Op.and vacío.
  if ((finalCondition[Op.and] as any[]).length === 0) {
    return {};
  }

  return finalCondition;
};

// Función para construir la condición include (sin cambios significativos)
const buildSpecialIncludeCondition = ({
  categoryId,
  showOnlyMyGroups,
  typeIds,
  userId, // Aseguramos que userId esté disponible para participantUsers
  viewSource
}: Request): Includeable[] => {
  
  // ============================================================
  // BLOQUE PREPARADO PARA LÓGICA ESPECÍFICA SEGÚN VIEWSOURCE
  // ============================================================
  // Por ahora, los includes son los mismos para todas las vistas
  // pero puedes agregar condiciones específicas aquí en el futuro
  
  // Ejemplo para el futuro:
  // if (viewSource === "grouped") {
  //   // Agregar includes adicionales específicos para "Agrupados"
  // }
  // ============================================================
  
  const includeCondition: Includeable[] = [
    {
      model: Contact,
      as: "contact",
      attributes: [
        "id",
        "name",
        "number",
        "domain",
        "profilePicUrl",
        "countryId",
        "isCompanyMember",
        "isExclusive",
        "traza_clientelicencia_id",
        "traza_clientelicencia_currentetapaid"
      ],
      include: [
        {
          model: ContactClientelicencias,
          as: "contactClientelicencias",
          required: false
        }
      ],
      required: true,
    },
    {
      model: Queue,
      as: "queue",
      attributes: ["id", "name", "color"]
    },
    {
      model: Whatsapp,
      as: "whatsapp",
      attributes: ["name"],
      include: [
        {
          model: User,
          attributes: ["id"],
          as: "userWhatsapps",
          required: false
        }
      ]
    },
    {
      model: Category,
      as: "categories",
      attributes: ["id", "name", "color"],
      ...(categoryId > 0 && {
        where: {
          id: categoryId
        },
        required: true
      })
    },
    {
      model: User,
      as: "user",
      attributes: ["id", "name"]
    },
    {
      model: User,
      as: "helpUsers",
      required: false
    },
    {
      model: User,
      as: "participantUsers",
      ...(showOnlyMyGroups && typeIds.length === 1 && typeIds.includes("group")
        ? {
            where: {
              id: +userId
            },
            required: true
          }
        : { required: false })
    },
    {
      model: MarketingCampaign,
      as: "marketingCampaign",
      required: false
    }
  ];

  return includeCondition;
};

const buildIncludeConditionForCount = ({
  searchParam,
  categoryId,
  userId,
  showOnlyMyGroups,
  typeIds,
  clientelicenciaEtapaIds,
}: Request): Includeable[] => {
  const includeCondition: Includeable[] = [];

  // ---------------------------------------------------------------
  // Contact (solo si searchParam existe o si clientelicenciaEtapaIds aplica)
  // ---------------------------------------------------------------
  const needsContact =
    Boolean(searchParam) ||
    (clientelicenciaEtapaIds && clientelicenciaEtapaIds.length > 0);

  if (needsContact) {
    includeCondition.push({
      model: Contact,
      as: "contact",
      attributes: [],
      required: true,
      include: [
        ...(clientelicenciaEtapaIds && clientelicenciaEtapaIds.length > 0
          ? [
              {
                model: ContactClientelicencias,
                as: "contactClientelicencias",
                required: false,
                attributes: []
              }
            ]
          : [])
      ]
    });
  }

  // ---------------------------------------------------------------
  // Category (solo si categoryId existe)
  // ---------------------------------------------------------------
  if (categoryId > 0) {
    includeCondition.push({
      model: Category,
      as: "categories",
      attributes: [],
      where: { id: categoryId },
      required: true
    });
  }

  // ---------------------------------------------------------------
  // ParticipantUsers (solo si es para ver mis grupos)
  // ---------------------------------------------------------------
  if (showOnlyMyGroups && typeIds.length === 1 && typeIds.includes("group")) {
    includeCondition.push({
      model: User,
      as: "participantUsers",
      attributes: [],
      where: {
        id: +userId
      },
      required: true
    })
  }

  return includeCondition;
  // return [];
};

const AdvancedListTicketsService = async (
  request: Request
): Promise<Response> => {

  // console.log(" --- AdvancedListTicketsService --- ", request);


  const { pageNumber = "1", viewSource, typeIds, ticketGroupType } = request;

  // Llenar userWhatsappsId si no está presente
  if (!request.userWhatsappsId) {
    const user = await User.findByPk(+request.userId, {
      attributes: ["id"],
      include: [
        {
          model: Whatsapp,
          attributes: ["id"],
          as: "userWhatsapps",
          required: false
        }
      ]
    });
    request.userWhatsappsId = user?.userWhatsapps.map(whatsapp => whatsapp.id) || [];
  }

  let whereCondition = buildSpecialWhereCondition(request);
  let includeCondition = buildSpecialIncludeCondition(request);
  let includeConditionForCount = buildIncludeConditionForCount(request);

  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  // ============================================================
  // LÓGICA ESPECIAL PARA "POR CLIENTES": EVITAR DUPLICADOS
  // ============================================================
  // Cuando estamos en la vista "Por Clientes", tanto grupos como individuales
  // pueden tener múltiples tickets (uno por cada conexión).
  // Para evitar duplicados, agrupamos:
  // - Grupos: por contactId
  // - Individuales: por contact.number (el número del cliente que escribe)
  
  // DETECCIÓN: Vista "Por Clientes" con GRUPOS
  const isGroupedViewWithGroups = viewSource === "grouped" && 
                                   typeIds && 
                                   typeIds.length > 0 && 
                                   typeIds.includes("group");

  // DETECCIÓN: Vista "Por Clientes" con INDIVIDUALES (en cualquier estado: no-response o in-progress)
  const isGroupedViewWithIndividuals = viewSource === "grouped" && 
                                        typeIds && 
                                        typeIds.length > 0 && 
                                        typeIds.includes("individual") &&
                                        (ticketGroupType === "no-response" || ticketGroupType === "in-progress");

  let tickets: Ticket[];
  
  if (isGroupedViewWithGroups) {
    // Para grupos en vista "Por Clientes": obtenemos todos y luego deduplicamos por contactId
    const allTickets = await Ticket.findAll({
      where: whereCondition,
      include: includeCondition,
      order: [["lastMessageTimestamp", "DESC"]],
      // No usamos limit/offset aquí porque primero necesitamos deduplicar
    });

    // Agrupar por contactId y mantener solo el ticket más reciente de cada grupo
    const ticketsByContact = new Map<number, Ticket>();
    allTickets.forEach(ticket => {
      const contactId = ticket.contactId;
      if (!ticketsByContact.has(contactId)) {
        // Guardamos el primero (más reciente por el order)
        ticketsByContact.set(contactId, ticket);
      }
    });

    // Convertir de vuelta a array y agregar información de conexiones múltiples
    const uniqueTickets = Array.from(ticketsByContact.values());
    
    // Agregar información de cuántas conexiones tiene cada grupo
    const ticketsWithConnectionCount = uniqueTickets.map(ticket => {
      const sameGroupTickets = allTickets.filter(t => t.contactId === ticket.contactId);
      const ticketPlain = ticket.get({ plain: true }) as any;
      return {
        ...ticketPlain,
        connectionCount: sameGroupTickets.length,
        availableConnections: sameGroupTickets.map(t => ({
          whatsappId: t.whatsappId,
          whatsappName: t.whatsapp?.name || 'Sin nombre'
        }))
      };
    });
    
    // Aplicar paginación manual
    tickets = ticketsWithConnectionCount.slice(offset, offset + limit) as any;
    
  } else if (isGroupedViewWithIndividuals) {
    // Para individuales en vista "Por Clientes": obtenemos todos y luego deduplicamos por contact.number
    const allTickets = await Ticket.findAll({
      where: whereCondition,
      include: includeCondition,
      order: [["lastMessageTimestamp", "DESC"]],
      // No usamos limit/offset aquí porque primero necesitamos deduplicar
    });

    // Agrupar por contact.number (el número del cliente que escribe)
    const ticketsByClientNumber = new Map<string, Ticket>();
    allTickets.forEach(ticket => {
      const clientNumber = ticket.contact?.number;
      if (clientNumber && !ticketsByClientNumber.has(clientNumber)) {
        // Guardamos el primero (más reciente por el order)
        ticketsByClientNumber.set(clientNumber, ticket);
      }
    });

    // Convertir de vuelta a array y agregar información de conexiones múltiples
    const uniqueTickets = Array.from(ticketsByClientNumber.values());
    
    // Agregar información de cuántas conexiones tiene cada cliente
    const ticketsWithConnectionCount = uniqueTickets.map(ticket => {
      const clientNumber = ticket.contact?.number;
      const sameClientTickets = allTickets.filter(t => t.contact?.number === clientNumber);
      const ticketPlain = ticket.get({ plain: true }) as any;
      return {
        ...ticketPlain,
        connectionCount: sameClientTickets.length,
        availableConnections: sameClientTickets.map(t => ({
          whatsappId: t.whatsappId,
          whatsappName: t.whatsapp?.name || 'Sin nombre'
        }))
      };
    });
    
    // Aplicar paginación manual
    tickets = ticketsWithConnectionCount.slice(offset, offset + limit) as any;
    
  } else {
    // Comportamiento normal para otras vistas
    tickets = await Ticket.findAll({
      where: whereCondition,
      include: includeCondition,
      limit,
      offset,
      order: [["lastMessageTimestamp", "DESC"]],
    });
  }

  // Para el count, también necesitamos ajustar si es vista "Por Clientes"
  let count: number;
  if (isGroupedViewWithGroups) {
    // Contar tickets distintos por contactId (para grupos)
    const countResult = await Ticket.findAll({
      where: whereCondition,
      include: includeConditionForCount,
      attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('Ticket.contactId')), 'contactId']],
      raw: true
    });
    count = countResult.length;
  } else if (isGroupedViewWithIndividuals) {
    // Contar tickets distintos por contact.number (para individuales)
    // Necesitamos hacer un query para obtener números únicos
    const allTicketsForCount = await Ticket.findAll({
      where: whereCondition,
      include: includeConditionForCount,
      attributes: ['id', 'contactId'],
    });
    
    // Crear un Set con los números únicos de clientes
    const uniqueClientNumbers = new Set<string>();
    allTicketsForCount.forEach(ticket => {
      const clientNumber = (ticket as any).contact?.number;
      if (clientNumber) {
        uniqueClientNumbers.add(clientNumber);
      }
    });
    
    count = uniqueClientNumbers.size;
  } else {
    count = await Ticket.count({
      where: whereCondition,
      include: includeConditionForCount,
      distinct: true,
    });
  }

  const hasMore = count > offset + tickets.length;

  return {
    tickets,
    count,
    hasMore,
    whereCondition,
    includeCondition
  };
};

export default AdvancedListTicketsService;
