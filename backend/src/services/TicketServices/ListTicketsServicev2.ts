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
import { getClientTimeWaitingForTickets } from "../../controllers/ReportsController";
import Category from "../../models/Category";
import Contact from "../../models/Contact";
import Queue from "../../models/Queue";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  status?: string;
  date?: string;
  showAll?: string;
  userId: string;
  withUnreadMessages?: string;
  whatsappIds: Array<number>;
  queueIds: Array<number>;
  typeIds: Array<string>;
  showOnlyMyGroups: boolean;
  categoryId?: number;
}

interface Response {
  tickets: any[];
  count: number;
  hasMore: boolean;
}

// Función para construir la condición where principal
const buildWhereCondition = ({
  userId,
  typeIds,
  queueIds,
  whatsappIds,
  categoryId,
  showAll,
  showOnlyMyGroups,
  searchParam,
  status,
  date,
  withUnreadMessages
}: Request): Filterable["where"] => {
  let baseCondition: Filterable["where"] = {};

  // si tengo status, entonces filtro por status
  if (status) {
    baseCondition = { ...baseCondition, status };
  }

  //  si tengo searchParam, entonces tmb busco por nombre o número
  if (searchParam) {
    const sanitizedSearchParam = searchParam.toLowerCase().trim();
    baseCondition = {
      ...baseCondition,
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

  // si solo estoy viendo mis individuales abiertos, entonces muestro los tickets que tengan mi userId o en los que este ayudando
  if (showAll !== "true" && typeIds[0] === "individual" && status === "open") {
    baseCondition = {
      ...baseCondition,
      [Op.or]: [
        { userId },
        {
          id: {
            [Op.in]: Sequelize.literal(
              `(SELECT \`ticketId\` FROM \`TicketHelpUsers\` WHERE \`userId\` = ${userId})`
            )
          }
        }
      ]
    };
  }

  // Si estoy viendo solo mis grupos o solo mis individuales abiertos
  // no voy a filtrar nada por departamento o conexión
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

  // REINICIO DE LA CONDICIÓN BASE
  // y valido solo el created at del ticket
  if (date) {
    baseCondition = {
      createdAt: {
        [Op.between]: [+startOfDay(parseISO(date)), +endOfDay(parseISO(date))]
      }
    };
  }

  // REINICIO DE LA CONDICIÓN BASE
  // ya no me acuerdo el pq de estas condiciones xd
  if (withUnreadMessages === "true") {
    baseCondition = {
      [Op.or]: [{ userId }, { status: "pending" }],
      ...(typeIds?.length && {
        isGroup: {
          [Op.or]: typeIds?.map(typeId => (typeId === "group" ? true : false))
        }
      }),
      ...(queueIds?.length && {
        queueId: {
          // @ts-ignore
          [Op.or]: queueIds?.includes(null)
            ? [queueIds.filter(id => id !== null), null]
            : [queueIds]
        }
      }),
      ...(whatsappIds?.length && {
        whatsappId: {
          [Op.or]: [whatsappIds]
        }
      }),
      unreadMessages: { [Op.gt]: 0 }
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
        "countryId"
      ],
      ...(searchParam && { required: true })
    },
    {
      model: Queue,
      as: "queue",
      attributes: ["id", "name", "color"]
    },
    {
      model: Whatsapp,
      as: "whatsapp",
      attributes: ["name"]
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
    }
  ];

  return includeCondition;
};

const ListTicketsServicev2 = async (request: Request): Promise<Response> => {
  const { pageNumber = "1", status } = request;

  let whereCondition = buildWhereCondition(request);
  let includeCondition = buildIncludeCondition(request);

  console.log("--- whereCondition", whereCondition);

  const limit = 40;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: tickets } = await Ticket.findAndCountAll({
    where: whereCondition,
    include: includeCondition,
    distinct: true,
    limit,
    offset,
    order: [["lastMessageTimestamp", "DESC"]]
  });

  const hasMore = count > offset + tickets.length;

  const filteredTickets = await filterWhenAksForClosedTickets(tickets, status);

  const ticketsToReturn = filteredTickets || tickets;

  const ticketsToReturnWithClientTimeWaiting =
    await getClientTimeWaitingForTickets(ticketsToReturn);

  return {
    tickets: ticketsToReturnWithClientTimeWaiting,
    count,
    hasMore
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

export default ListTicketsServicev2;