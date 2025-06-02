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
import Notification from "../../models/Notification";
import Message from "../../models/Message";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  seen?: boolean;
  userId: string;
  selectedUsersIds?: number[];
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
  searchParam,
  seen,
  selectedUsersIds
}: Request): Filterable["where"] => {
  let baseCondition: Filterable["where"] = {};

  // si tengo status, entonces filtro por status
  if (seen) {
    baseCondition = { ...baseCondition, seen };
  }

  if (selectedUsersIds && selectedUsersIds.length > 0) {
    baseCondition = {
      ...baseCondition,
      toUserId: { [Op.in]: selectedUsersIds },
    };
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

  return baseCondition;
};

// Función para construir la condición include
const buildIncludeCondition = ({
  searchParam,
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
        "isExclusive"
      ],
      ...(searchParam && { required: true })
    },
    {
      model: Message,
      as: "message",
      required: false,
      include: [
        {
          model: Contact,
          as: "contact",
          required: false,
        }
      ]
    },
    {
      model: Ticket,
      as: "ticket",
      include: [
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
            "isExclusive"
          ],
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
          required: false
        },
        {
          model: MarketingCampaign,
          as: "marketingCampaign",
          required: false
        }
      ]
    }
  ];

  return includeCondition;
};

const ListNotificationsService = async (request: Request): Promise<Response> => {
  const { pageNumber = "1" } = request;

  // console.log("--- user", user.userWhatsapps);

  let whereCondition = buildWhereCondition(request);
  let includeCondition = buildIncludeCondition(request);

  // console.log("--- whereCondition", whereCondition);

  const limit = 40;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: tickets } = await Notification.findAndCountAll({
    where: whereCondition,
    include: includeCondition,
    limit,
    offset,
    order: [["createdAt", "DESC"]]
  });

  const hasMore = count > offset + tickets.length;

  const ticketsToReturn = tickets;

  return {
    tickets: ticketsToReturn,
    count,
    hasMore,
    whereCondition,
    includeCondition
  };
};

export default ListNotificationsService;
