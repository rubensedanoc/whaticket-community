import { Op, Sequelize } from "sequelize";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";

interface Request {
  searchParam?: string;
  pageNumber?: string;
}

interface Response {
  contacts: Contact[];
  count: number;
  hasMore: boolean;
}

const ListContactsService = async ({
  searchParam = "",
  pageNumber = "1"
}: Request): Promise<Response> => {
  const whereCondition = {
    [Op.or]: [
      {
        name: Sequelize.where(
          Sequelize.fn(
            "LOWER",
            Sequelize.fn("REPLACE", Sequelize.col("name"), " ", "")
          ),
          "LIKE",
          `%${searchParam.toLowerCase().trim().replace(/\s+/g, "")}%`
        )
      },
      {
        number: Sequelize.where(
          Sequelize.fn("REPLACE", Sequelize.col("number"), "+", ""),
          "LIKE",
          `%${searchParam
            .toLowerCase()
            .trim()
            .replace(/\s+/g, "")
            .replace(/\+/g, "")}%`
        )
      }
    ]
  };
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: contacts } = await Contact.findAndCountAll({
    where: whereCondition,
    include: [
      {
        model: Ticket,
        as: "tickets",
        required: false
      }
    ],
    limit,
    offset,
    order: [["name", "ASC"]]
  });

  const hasMore = count > offset + contacts.length;

  return {
    contacts,
    count,
    hasMore
  };
};

export default ListContactsService;
