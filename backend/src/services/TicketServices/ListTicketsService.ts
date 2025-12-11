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

interface Request {
  searchParam?: string;
  pageNumber?: string;
  status?: string;
  showAll?: string;
  userId: string;
  whatsappIds: Array<number>;
  queueIds: Array<number>;
  ticketUsersIds: Array<number>;
  marketingCampaignIds: Array<number>;
  typeIds: Array<string>;
  showOnlyMyGroups: boolean;
  categoryId?: number;
  userWhatsappsId?: number[];
  showOnlyWaitingTickets?: boolean;
  clientelicenciaEtapaIds?: number[];
  viewSource?: string;
}

interface Response {
  tickets: any[];
  count: number;
  hasMore: boolean;
  whereCondition: Filterable["where"];
  includeCondition: Includeable[];
}

// Función para construir la condición where principal
const buildWhereCondition = ({
  userId,
  typeIds,
  queueIds,
  ticketUsersIds,
  marketingCampaignIds,
  whatsappIds,
  categoryId,
  showAll,
  showOnlyMyGroups,
  searchParam,
  status,
  userWhatsappsId,
  showOnlyWaitingTickets,
  clientelicenciaEtapaIds,
  viewSource
}: Request): Filterable["where"] => {
  
  // ============================================================
  // BLOQUE PREPARADO PARA LÓGICA ESPECÍFICA SEGÚN VIEWSOURCE
  // ============================================================
  // Por ahora usa la misma lógica, pero puedes agregar
  // condiciones específicas en el futuro
  //
  // Ejemplo:
  // if (viewSource === "grouped") {
  //   // Agregar filtros específicos para "Agrupados"
  // }
  // ============================================================
  
  let baseCondition: Filterable["where"] = {};

  // si tengo status, entonces filtro por status
  if (status) {
    baseCondition = { ...baseCondition, status };
    
    // Si es status "closed", filtramos solo los tickets cerrados del mes actual
    if (status === "closed") {
      const now = new Date();
      const firstDayOfMonth = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      const lastDayOfMonth = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      
      baseCondition = {
        ...baseCondition,
        updatedAt: {
          [Op.gte]: firstDayOfMonth,
          [Op.lte]: lastDayOfMonth
        }
      };
    }
  }

  //  si tengo searchParam, entonces tmb busco por nombre o número
  if (searchParam) {
    const sanitizedSearchParam = searchParam.toLowerCase().trim();
    baseCondition = {
      ...baseCondition,
      [Op.and]: [
        {
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
        }
      ]
    };
  }

  // si tengo typeIs ("group" o "individual" o los 2)
  // entonces uso el isGroup del ticket para filtrar
  if (typeIds?.length) {
    baseCondition = {
      ...baseCondition,
      isGroup: { [Op.or]: typeIds.map(typeId => typeId === "group") }
    };
  }

  if (showOnlyWaitingTickets) {
    baseCondition = {
      ...baseCondition,
      beenWaitingSinceTimestamp: {
        [Op.not]: null
      }
    };
  }

  if (clientelicenciaEtapaIds.length) {
    baseCondition = {
      ...baseCondition,
      "$contact.traza_clientelicencia_currentetapaid$": {
        [Op.or]: clientelicenciaEtapaIds.includes(null)
          ? [clientelicenciaEtapaIds.filter(id => id !== null), null]
          : [clientelicenciaEtapaIds]
      }
    };
  }

  // si solo estoy viendo mis individuales abiertos, entonces muestro los tickets que tengan mi userId o en los que este ayudando
  if (showAll !== "true" && typeIds[0] === "individual" && status === "open") {
    baseCondition = {
      ...baseCondition,
      [Op.and]: [
        ...(baseCondition[Op.and] || []),
        {
          [Op.or]: [
            { userId },
            {
              id: {
                [Op.in]: Sequelize.literal(
                  `(SELECT \`ticketId\` FROM \`TicketHelpUsers\` WHERE \`userId\` = ${userId})`
                )
              }
            },
            ...(searchParam && userWhatsappsId.length > 0
              ? [
                  {
                    whatsappId: {
                      [Op.in]: userWhatsappsId
                    }
                  }
                ]
              : [])
          ]
        }
      ]
    };
  }

  // Si no estoy viendo solo mis grupos o solo mis individuales abiertos O si no hay searchparam
  // voy a permitir filtrar por departamento o conexión
  if (
    !(
      typeIds.length === 1 &&
      ((showAll !== "true" &&
        typeIds[0] === "individual" &&
        status === "open") ||
        (showOnlyMyGroups && typeIds[0] === "group"))
    )
  ) {
    if (queueIds?.length) {
      baseCondition = {
        ...baseCondition,
        queueId: {
          [Op.or]: queueIds.includes(null)
            ? [queueIds.filter(id => id !== null), null]
            : [queueIds]
        }
      };
    }
    if (ticketUsersIds?.length) {
      baseCondition = {
        ...baseCondition,
        [Op.and]: [
          ...(baseCondition[Op.and] || []),
          {
            [Op.or]: [
              {
                userId: {
                  [Op.in]: ticketUsersIds
                }
              },
              {
                id: {
                  [Op.in]: Sequelize.literal(
                    `(SELECT \`ticketId\` FROM \`TicketHelpUsers\` WHERE \`userId\` IN (${ticketUsersIds.join(",")}))`
                  )
                }
              },
              Sequelize.literal(
                `EXISTS (
                  SELECT 1
                  FROM \`TicketParticipantUsers\`
                  WHERE \`TicketParticipantUsers\`.\`ticketId\`  = \`Ticket\`.\`id\`
                  AND \`TicketParticipantUsers\`.\`userId\` IN (${ticketUsersIds.join(",")})
                )`
              )
            ]
          }
        ]
      };
    }
    if (marketingCampaignIds?.length) {
      baseCondition = {
        ...baseCondition,
        marketingCampaignId: {
          [Op.or]: marketingCampaignIds.includes(null)
            ? [marketingCampaignIds.filter(id => id !== null), null]
            : [marketingCampaignIds]
        }
      };
    }
    if (whatsappIds?.length) {
      baseCondition = {
        ...baseCondition,
        whatsappId: {
          [Op.or]: whatsappIds
        }
      };
    }
  }

  // si tengo categoryId = 0, entonces busco solo los tickets que no
  // tienen ninguna categoria asignada
  if (categoryId === 0) {
    baseCondition = {
      ...baseCondition,
      [Op.and]: [
        ...(baseCondition[Op.and] || []),
        Sequelize.literal(
          `NOT EXISTS (
            SELECT 1
            FROM \`TicketCategories\`
            WHERE \`TicketCategories\`.\`ticketId\`  = \`Ticket\`.\`id\`
          )`
        )
      ]
    };
  }

  return baseCondition;
};

// Función para construir la condición include
const buildIncludeCondition = ({
  searchParam,
  categoryId,
  userId,
  showOnlyMyGroups,
  typeIds
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
          required: false,
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
      attributes: ["id", "name"],
      required: false
    },
    {
      model: User,
      as: "participantUsers",
      attributes: ["id", "name"],
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

const ListTicketsService = async (request: Request): Promise<Response> => {
  const { pageNumber = "1", status } = request;

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

  request.userWhatsappsId = user.userWhatsapps.map(whatsapp => whatsapp.id);


  let whereCondition = buildWhereCondition(request);
  let includeCondition = buildIncludeCondition(request);
  let includeConditionForCount = buildIncludeConditionForCount(request);

  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const tickets = await Ticket.findAll({
    where: whereCondition,
    include: includeCondition,
    limit,
    offset,
    order: [["lastMessageTimestamp", "DESC"]],
    // logging(sql) {
    //   console.log(sql);
    // }
  });

  const count = await Ticket.count({
    where: whereCondition,
    include: includeConditionForCount,
    distinct: true,
    // logging(sql) {
    //   console.log(sql);
    // }
  });

  const hasMore = count > offset + tickets.length;

  const filteredTickets = await filterWhenAksForClosedTickets(tickets, status);

  const ticketsToReturn = filteredTickets || tickets;

  return {
    tickets: ticketsToReturn,
    count,
    hasMore,
    whereCondition,
    includeCondition
  };
};

// Función para filtrar solamente cuando piden los tickets cerrados
// hace un filtrado para devolver los cerrados que no tengan
// un ticket hermano abierto o pendiente
const filterWhenAksForClosedTickets = async (
  tickets: Ticket[],
  status: string | undefined
): Promise<Ticket[] | null> => {
  if (status !== "closed") return null;

  return (
    await Promise.all(
      tickets.map(async ticket => {
        const similarTicket = await Ticket.findOne({
          attributes: ["id"],
          where: {
            whatsappId: ticket.whatsappId,
            contactId: ticket.contactId,
            status: ["pending", "open"]
          }
        });

        return !similarTicket ? ticket : null;
      })
    )
  ).filter(ticket => ticket !== null) as Ticket[];
};

export default ListTicketsService;
