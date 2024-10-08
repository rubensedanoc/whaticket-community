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
import { searchIfNumbersAreExclusive } from "../../libs/searchIfNumbersAreExclusive";
import Category from "../../models/Category";
import Contact from "../../models/Contact";
import Queue from "../../models/Queue";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";
import ShowUserService from "../UserServices/ShowUserService";

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
}

interface Response {
  tickets: any[];
  count: number;
  hasMore: boolean;
}

const ListTicketsService = async ({
  searchParam = "",
  pageNumber = "1",
  whatsappIds,
  queueIds,
  typeIds,
  status,
  date,
  showAll,
  userId,
  withUnreadMessages,
  showOnlyMyGroups
}: Request): Promise<Response> => {
  let whereCondition: Filterable["where"] = {
    [Op.or]: [
      { userId },
      {
        id: {
          [Op.in]: Sequelize.literal(
            `(
          SELECT \`ticketId\` FROM \`TicketHelpUsers\` WHERE \`userId\` = ${userId}
        )`
          )
        }
      },
      { status: "pending" }
    ],
    ...(typeIds?.length && {
      isGroup: {
        [Op.or]: typeIds?.map(typeId => (typeId === "group" ? true : false))
      }
    }),
    // si no estoy viendo la tab de mis chats, entonces aplico filtros de queues y whatsapp
    ...(!(typeIds.length === 1 && typeIds[0] === "individual") && {
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
      })
    })
  };
  let includeCondition: Includeable[];

  includeCondition = [
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
      attributes: ["id", "name", "color"]
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

  if (showAll === "true") {
    whereCondition = {
      ...(typeIds?.length && {
        isGroup: {
          [Op.or]: typeIds?.map(typeId => (typeId === "group" ? true : false))
        }
      }),

      // si no estoy viendo la tab de mis grupos, entonces aplico filtros de queues y whatsapp
      ...(!(
        typeIds.length === 1 &&
        typeIds[0] === "group" &&
        showOnlyMyGroups
      ) && {
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
        })
      })
    };
  }

  if (status) {
    whereCondition = {
      ...whereCondition,
      status
    };
  }

  if (searchParam) {
    const sanitizedSearchParam = searchParam.toLocaleLowerCase().trim();

    includeCondition = [
      ...includeCondition
      // {
      //   model: Message,
      //   as: "messages",
      //   attributes: ["id", "body"],
      //   where: {
      //     body: where(
      //       fn("LOWER", col("body")),
      //       "LIKE",
      //       `%${sanitizedSearchParam}%`
      //     )
      //   },
      //   required: false,
      //   duplicating: false
      // }
    ];

    whereCondition = {
      ...whereCondition,
      [Op.or]: [
        {
          "$contact.name$": where(
            fn("LOWER", col("contact.name")),
            "LIKE",
            `%${sanitizedSearchParam}%`
          )
        },
        { "$contact.number$": { [Op.like]: `%${sanitizedSearchParam}%` } }
        // {
        //   "$message.body$": where(
        //     fn("LOWER", col("body")),
        //     "LIKE",
        //     `%${sanitizedSearchParam}%`
        //   )
        // }
      ]
    };
  }

  if (date) {
    whereCondition = {
      createdAt: {
        [Op.between]: [+startOfDay(parseISO(date)), +endOfDay(parseISO(date))]
      }
    };
  }

  if (withUnreadMessages === "true") {
    const user = await ShowUserService(userId);
    const userQueueIds = user.queues.map(queue => queue.id);

    whereCondition = {
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

  const limit = 40;
  const offset = limit * (+pageNumber - 1);

  console.log("________-whereCondition", whereCondition);

  // console.log(
  //   typeIds,
  //   "Ticket.findAndCountAll where shoGroups",
  //   // @ts-ignore
  //   whereCondition?.isGroup
  // );
  // // @ts-ignore
  // console.log("Ticket.findAndCountAll where queId", whereCondition?.queueId);
  // console.log(
  //   "Ticket.findAndCountAll where whatsappId",
  //   // @ts-ignore
  //   whereCondition?.whatsappId
  // );

  const { count, rows: tickets } = await Ticket.findAndCountAll({
    where: whereCondition,
    include: includeCondition,
    distinct: true,
    limit,
    offset,
    order: [["lastMessageTimestamp", "DESC"]]
  });

  let filteredTickets: Ticket[] | null = null;

  // @ts-ignore
  if (whereCondition.status === "closed") {
    console.log("______SE PIDIERON SOLO LOS TICKETS CERRADOS");

    filteredTickets = (
      await Promise.all(
        tickets.map(async ticket => {
          const similiarTicketsButOpensOrPendings = await Ticket.findAll({
            where: {
              whatsappId: ticket.whatsappId,
              contactId: ticket.contactId,
              status: ["pending", "open"]
            }
          });

          return similiarTicketsButOpensOrPendings.length === 0 ? ticket : null;
        })
      )
    ).filter(ticket => ticket !== null) as Ticket[];
  }

  const hasMore = count > offset + tickets.length;

  const ticketsToReturn = filteredTickets || tickets;

  const ticketsToReturnWithClientTimeWaiting =
    await getClientTimeWaitingForTickets(ticketsToReturn);

  const exclusiveContactsNumbers = await searchIfNumbersAreExclusive({
    numbers: ticketsToReturnWithClientTimeWaiting
      .map(ticket => +ticket.contact.number)
      .filter(n => n)
  });

  for (const number in exclusiveContactsNumbers) {
    ticketsToReturnWithClientTimeWaiting
      .filter(t => t.contact.number === number)
      .forEach(t => (t.contact.isExclusive = true));

    // ticketsToReturnWithClientTimeWaiting.find(
    //   t => t.contact.number === number
    // ).contact.isExclusive = true;
  }

  return {
    tickets: ticketsToReturnWithClientTimeWaiting,
    count,
    hasMore
  };
};

export default ListTicketsService;
