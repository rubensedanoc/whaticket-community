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
  date?: string; // Incluido, con advertencia de sobrescritura
  showAll?: string; // Incluido por compatibilidad, aunque no se usa en la lógica de grupos
  userId: string;
  withUnreadMessages?: string; // Incluido, con advertencia de sobrescritura
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
  date,
  withUnreadMessages,
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
  showAll
}: Request): Filterable["where"] => {

  console.log({
    userId,
    searchParam,
    status,
    date,
    withUnreadMessages,
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
    showAll
  });

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

  // ATENCIÓN: Estos filtros DEBEN ser manejados con EXTREMA PRECAUCIÓN.
  // Su lógica original podría sobrescribir otras partes de la condición.
  // Se agregan al final para que cualquier filtro anterior tenga prioridad si hay conflicto.

  if (date) {
    console.warn("ADVERTENCIA: El filtro 'date' se aplicará como AND sobre otras condiciones. Confirme su comportamiento deseado.");
    (finalCondition[Op.and] as any[]).push({
      createdAt: {
        [Op.between]: [+startOfDay(parseISO(date)), +endOfDay(parseISO(date))]
      }
    });
  }

  if (withUnreadMessages === "true") {
    console.warn("ADVERTENCIA: El filtro 'withUnreadMessages' se aplicará como AND. Confirme su comportamiento deseado.");
    (finalCondition[Op.and] as any[]).push({
      [Op.or]: [{ userId }, { status: "pending" }], // Lógica específica de unreadMessages
      unreadMessages: { [Op.gt]: 0 },
      ...(typeIds?.length && {
        isGroup: {
          [Op.or]: typeIds?.map(typeId => (typeId === "group" ? true : false))
        }
      }),
      ...(queueIds?.length && {
        queueId: {
          [Op.or]: queueIds?.includes(null)
            ? [queueIds.filter(id => id !== null), null]
            : [queueIds]
        }
      }),
      ...(whatsappIds?.length && {
        whatsappId: {
          [Op.or]: [whatsappIds]
        }
      })
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
  userId // Aseguramos que userId esté disponible para participantUsers
}: Request): Includeable[] => {
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

const AdvancedListTicketsService = async (
  request: Request
): Promise<Response> => {

  console.log(" --- AdvancedListTicketsService --- ", request);


  const { pageNumber = "1" } = request;

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

  const limit = 40;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: tickets } = await Ticket.findAndCountAll({
    where: whereCondition,
    include: includeCondition,
    distinct: true,
    limit,
    offset,
    order: [["lastMessageTimestamp", "DESC"]],
    logging(sql, timing) {
      console.log(`SQL: ${request.ticketGroupType} ${sql} - Timing: ${timing}ms`);
    },
  });

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
