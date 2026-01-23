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
export type TicketGroupType = "no-response" | "in-progress" | "my-department" | "other-departments";

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
  
  // Flag para forzar filtrado por userId en impersonación
  forceUserIdFilter?: boolean;
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
  viewSource,
  forceUserIdFilter
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

  // ============================================================
  // LÓGICA ESPECIAL PARA VISTA GROUPED CON USUARIO CON UNA CONEXIÓN ESPECÍFICA Y UN DEPARTAMENTO
  // Un usuario solo tiene una conexión, una conexión solo pertenece a un departamento
  // Solo aplica cuando: viewSource="grouped" + 1 conexión + 1 departamento
  // ============================================================
  const isGroupedView = viewSource === "grouped";
  const userHasOneConnection = userWhatsappsId && userWhatsappsId.length === 1;
  const userHasOneDepartment = queueIds && queueIds.length === 1;
  const shouldUseSpecialLogic = isGroupedView && userHasOneConnection && userHasOneDepartment;
  
  // Lógica principal basada en el tipo de grupo solicitado
  if (ticketGroupType === "no-response") {
    if (shouldUseSpecialLogic) {
      // LÓGICA ESPECIAL PARA GROUPED: Solo tickets sin respuesta de SUS conexiones
      // ✅ Sin límite de tiempo: mostrar TODOS los tickets esperando respuesta inmediatamente
      (finalCondition[Op.and] as any[]).push({
        [Op.or]: [
          // Condición para chats individuales (pendientes) de sus conexiones
          {
            isGroup: false,
            status: { [Op.in]: ["pending"] },
            whatsappId: { [Op.in]: userWhatsappsId },
            transferred: { [Op.or]: [false, null] }
          },
          // Condición para chats individuales (abiertos) sin respuesta de sus conexiones
          {
            isGroup: false,
            status: { [Op.in]: ["open"] },
            beenWaitingSinceTimestamp: { [Op.not]: null },
            whatsappId: { [Op.in]: userWhatsappsId },
            transferred: { [Op.or]: [false, null] }
          },
          // Condición para chats grupales sin respuesta de sus conexiones
          {
            isGroup: true,
            status: { [Op.in]: ["open"] },
            beenWaitingSinceTimestamp: { [Op.not]: null },
            whatsappId: { [Op.in]: userWhatsappsId },
            transferred: { [Op.or]: [false, null] }
          }
        ]
      });
    } else {
      // LÓGICA ORIGINAL: tickets de todas las conexiones
      // ✅ Sin límite de tiempo: mostrar TODOS los tickets esperando respuesta inmediatamente
      (finalCondition[Op.and] as any[]).push({
        [Op.or]: [
          // Condición para chats individuales (pendientes)
          {
            isGroup: false,
            status: { [Op.in]: ["pending"] },
            transferred: { [Op.or]: [false, null] }
          },
          // Condición para chats individuales (abiertos) sin respuesta
          {
            isGroup: false,
            status: { [Op.in]: ["open"] },
            beenWaitingSinceTimestamp: { [Op.not]: null },
            transferred: { [Op.or]: [false, null] }
          },
          // Condición para chats grupales sin respuesta
          {
            isGroup: true,
            status: { [Op.in]: ["open"] },
            beenWaitingSinceTimestamp: { [Op.not]: null },
            transferred: { [Op.or]: [false, null] }
          }
        ]
      });
    }
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
  } else if (ticketGroupType === "my-department") {
    // === MI DEPARTAMENTO ===
    if (shouldUseSpecialLogic) {
      // LÓGICA ESPECIAL PARA GROUPED: Tickets del usuario (de su conexión o transferidos)
      // ✅ Excluye tickets esperando respuesta (evita duplicados con "Sin Respuesta")
      // ✅ Para GRUPOS: incluye si está en TicketParticipantUsers
      const condition: any = {
        [Op.or]: [
          // Tickets individuales asignados al usuario
          { userId: userId },
          // Tickets grupales donde el usuario está en TicketParticipantUsers
          Sequelize.literal(
            `EXISTS (
              SELECT 1 FROM \`TicketParticipantUsers\` 
              WHERE \`TicketParticipantUsers\`.\`ticketId\` = \`Ticket\`.\`id\` 
              AND \`TicketParticipantUsers\`.\`userId\` = ${userId}
            )`
          )
        ],
        status: { [Op.in]: ["open"] },
        beenWaitingSinceTimestamp: null // Solo tickets que NO están esperando respuesta
      };
      if (queueIds && queueIds.length > 0) {
        condition.queueId = { [Op.in]: queueIds };
      }
      (finalCondition[Op.and] as any[]).push(condition);
    } else {
      // LÓGICA ORIGINAL: Tickets del usuario
      // ✅ Excluye tickets esperando respuesta (evita duplicados con "Sin Respuesta")
      // ✅ Para GRUPOS: incluye si está en TicketParticipantUsers
      const condition: any = {
        [Op.or]: [
          // Tickets individuales asignados al usuario
          { userId: userId },
          // Tickets grupales donde el usuario está en TicketParticipantUsers
          Sequelize.literal(
            `EXISTS (
              SELECT 1 FROM \`TicketParticipantUsers\` 
              WHERE \`TicketParticipantUsers\`.\`ticketId\` = \`Ticket\`.\`id\` 
              AND \`TicketParticipantUsers\`.\`userId\` = ${userId}
            )`
          )
        ],
        status: { [Op.in]: ["open"] },
        beenWaitingSinceTimestamp: null // Solo tickets que NO están esperando respuesta
      };
      if (queueIds && queueIds.length > 0) {
        condition.queueId = { [Op.in]: queueIds };
      }
      (finalCondition[Op.and] as any[]).push(condition);
    }
  } else if (ticketGroupType === "other-departments") {
    // === OTROS DEPARTAMENTOS ===
    if (shouldUseSpecialLogic) {
      // LÓGICA ESPECIAL PARA GROUPED: Tickets de SUS conexiones tomados por otros O sin asignar
      // ✅ Excluye tickets esperando respuesta (evita duplicados con "Sin Respuesta")
      // ✅ Para GRUPOS: excluye si el usuario está en TicketParticipantUsers
      const baseCondition: any = {
        userId: { [Op.or]: [{ [Op.is]: null }, { [Op.ne]: userId }] }, // Incluye NULL (sin asignar) y otros usuarios
        status: { [Op.in]: ["open"] },
        whatsappId: { [Op.in]: userWhatsappsId },
        beenWaitingSinceTimestamp: null // Solo tickets que NO están esperando respuesta
      };
      if (queueIds && queueIds.length > 0) {
        baseCondition.queueId = { [Op.in]: queueIds };
      }
      // Excluir grupos donde el usuario está en TicketParticipantUsers
      (finalCondition[Op.and] as any[]).push({
        [Op.and]: [
          baseCondition,
          Sequelize.literal(
            `NOT EXISTS (
              SELECT 1 FROM \`TicketParticipantUsers\` 
              WHERE \`TicketParticipantUsers\`.\`ticketId\` = \`Ticket\`.\`id\` 
              AND \`TicketParticipantUsers\`.\`userId\` = ${userId}
            )`
          )
        ]
      });
    } else {
      // LÓGICA ORIGINAL: Tickets de los departamentos tomados por otros O sin asignar
      // ✅ Excluye tickets esperando respuesta (evita duplicados con "Sin Respuesta")
      // ✅ Para GRUPOS: excluye si el usuario está en TicketParticipantUsers
      const baseCondition: any = {
        userId: { [Op.or]: [{ [Op.is]: null }, { [Op.ne]: userId }] }, // Incluye NULL (sin asignar) y otros usuarios
        status: { [Op.in]: ["open"] },
        beenWaitingSinceTimestamp: null // Solo tickets que NO están esperando respuesta
      };
      if (queueIds && queueIds.length > 0) {
        baseCondition.queueId = { [Op.in]: queueIds };
      }
      // Excluir grupos donde el usuario está en TicketParticipantUsers
      (finalCondition[Op.and] as any[]).push({
        [Op.and]: [
          baseCondition,
          Sequelize.literal(
            `NOT EXISTS (
              SELECT 1 FROM \`TicketParticipantUsers\` 
              WHERE \`TicketParticipantUsers\`.\`ticketId\` = \`Ticket\`.\`id\` 
              AND \`TicketParticipantUsers\`.\`userId\` = ${userId}
            )`
          )
        ]
      });
    }
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
        [Op.in]: queueIds.includes(null)
          ? [...queueIds.filter(id => id !== null), null]
          : queueIds
      }
    });
  }

  // Filtrado por MarketingCampaign
  if (marketingCampaignIds?.length) {
    (finalCondition[Op.and] as any[]).push({
      marketingCampaignId: {
        [Op.in]: marketingCampaignIds.includes(null)
          ? [...marketingCampaignIds.filter(id => id !== null), null]
          : marketingCampaignIds
      }
    });
  }

  // Filtrado por Whatsapp
  // ✅ Para "my-department": NO filtrar por conexión (ver tickets transferidos de otras conexiones)
  // ✅ Para "no-response" y "other-departments": SÍ filtrar por conexión
  if (ticketGroupType !== "my-department") {
    if (whatsappIds?.length) {
      (finalCondition[Op.and] as any[]).push({
        whatsappId: {
          [Op.in]: whatsappIds
        }
      });
    } else if (userWhatsappsId?.length) {
      // ✅ Si no hay whatsappIds seleccionados, usar las conexiones del usuario automáticamente
      (finalCondition[Op.and] as any[]).push({
        whatsappId: {
          [Op.in]: userWhatsappsId
        }
      });
    }
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
  // Solo agregar filtro si NO se quieren ambos tipos
  if (typeIds?.length && !(typeIds.includes("individual") && typeIds.includes("group"))) {
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
  // TAMBIÉN aplica si forceUserIdFilter es true (para impersonación)
  const shouldFilterByUserId = (showAll !== "true" && typeIds[0] === "individual" && status === "open") || 
                                (forceUserIdFilter === true);
  
  if (shouldFilterByUserId) {
    // Para GRUPOS: solo filtrar por TicketHelpUsers (participantes)
    if (typeIds.includes("group") && !typeIds.includes("individual")) {
      (finalCondition[Op.and] as any[]).push({
        id: {
          [Op.in]: Sequelize.literal(
            `(SELECT \`ticketId\` FROM \`TicketHelpUsers\` WHERE \`userId\` = ${userId})`
          )
        }
      });
    } 
    // Para INDIVIDUALES: filtrar por userId O TicketHelpUsers
    else if (typeIds.includes("individual") && !typeIds.includes("group")) {
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
  if (!request.userWhatsappsId || request.userWhatsappsId.length === 0) {
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
    
    // Si userWhatsappsId sigue vacío pero hay whatsappIds, usar esos
    if (request.userWhatsappsId.length === 0 && request.whatsappIds && request.whatsappIds.length > 0) {
      request.userWhatsappsId = request.whatsappIds;
    }
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
      subQuery: false, // Evita problemas con limit en queries con includes
      // No usamos limit/offset aquí porque primero necesitamos deduplicar
    });

    // FILTRAR tickets que NO tienen contact (esto previene errores)
    const validTickets = allTickets.filter(ticket => ticket.contact && ticket.contact.number);

    // Agrupar por contact.number (el número del cliente que escribe)
    const ticketsByClientNumber = new Map<string, Ticket>();
    validTickets.forEach(ticket => {
      const clientNumber = ticket.contact!.number; // Ya validamos que existe
      if (!ticketsByClientNumber.has(clientNumber)) {
        // Guardamos el primero (más reciente por el order)
        ticketsByClientNumber.set(clientNumber, ticket);
      }
    });

    // Convertir de vuelta a array y agregar información de conexiones múltiples
    const uniqueTickets = Array.from(ticketsByClientNumber.values());
    
    // Agregar información de cuántas conexiones tiene cada cliente
    const ticketsWithConnectionCount = uniqueTickets.map(ticket => {
      const clientNumber = ticket.contact!.number; // Ya validamos que existe
      const sameClientTickets = validTickets.filter(t => t.contact!.number === clientNumber);
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
    // Necesitamos incluir Contact para acceder al número
    const allTicketsForCount = await Ticket.findAll({
      where: whereCondition,
      include: [
        {
          model: Contact,
          as: "contact",
          attributes: ['number'],
          required: true
        },
        ...includeConditionForCount.filter(inc => (inc as any).as !== 'contact')
      ],
      attributes: ['id', 'contactId'],
      subQuery: false, // Evita problemas con includes
    });
    
    // Crear un Set con los números únicos de clientes (filtrando los que tienen contact válido)
    const uniqueClientNumbers = new Set<string>();
    allTicketsForCount.forEach(ticket => {
      const clientNumber = ticket.contact?.number;
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
