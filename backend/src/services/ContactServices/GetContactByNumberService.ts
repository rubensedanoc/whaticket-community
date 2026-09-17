import { Op } from "sequelize";
import Contact from "../../models/Contact";
import NormalizePhoneNumber from "../../helpers/NormalizePhoneNumber";

interface Request {
  number: string;
}

const GetContactByNumberService = async ({
  number
}: Request): Promise<Contact> => {
  const digits = String(number || "").replace(/\D/g, "");

  // Búsqueda tolerante: se intenta con el número tal cual y con su forma normalizada,
  // para que buscar "987654321" encuentre al contacto guardado como "51987654321".
  const possibleNumbers = new Set<string>([number, digits]);

  const normalized = await NormalizePhoneNumber(digits, {
    defaultCountryCode: process.env.DEFAULT_COUNTRY_CODE || "51"
  });

  if (normalized) {
    possibleNumbers.add(normalized.number);
  }

  const numberExists = await Contact.findOne({
    where: { number: { [Op.in]: [...possibleNumbers].filter(Boolean) } }
  });

  return numberExists;
};

export default GetContactByNumberService;
