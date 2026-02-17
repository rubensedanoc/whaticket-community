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
  // Si no hay searchParam, retornar lista vacía o sin filtro
  const normalizedSearch = searchParam.trim();
  
  let whereCondition: any = {};
  
  if (normalizedSearch) {
    const searchWithoutSpaces = normalizedSearch.toLowerCase().replace(/\s+/g, "");
    let searchOnlyNumbers = normalizedSearch.replace(/[^0-9]/g, "");
    
    // Remover el 0 después del código de país si existe
    // Esto maneja el prefijo nacional que algunos países usan (ej: 5930995... → 593995...)
    // Funciona para códigos de país de 1-3 dígitos seguidos de 0
    if (searchOnlyNumbers.length >= 10) {
      // Intentar remover 0 después de 1, 2 o 3 dígitos iniciales
      searchOnlyNumbers = searchOnlyNumbers.replace(/^(\d{1,3})0(\d{8,})$/, '$1$2');
    }
    
    whereCondition = {
      [Op.or]: [
        {
          name: Sequelize.where(
            Sequelize.fn(
              "LOWER",
              Sequelize.fn("REPLACE", Sequelize.col("name"), " ", "")
            ),
            "LIKE",
            `%${searchWithoutSpaces}%`
          )
        },
        ...(searchOnlyNumbers ? [{
          number: Sequelize.where(
            Sequelize.fn("TRIM", Sequelize.col("number")),
            "LIKE",
            `%${searchOnlyNumbers}%`
          )
        }] : [])
      ]
    };
  }
  
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
