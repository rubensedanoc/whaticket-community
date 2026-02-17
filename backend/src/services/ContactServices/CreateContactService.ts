import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import { getCountryIdOfNumber } from "./CreateOrUpdateContactService";

interface ExtraInfo {
  name: string;
  value: string;
}

interface Request {
  name: string;
  number: string;
  email?: string;
  profilePicUrl?: string;
  extraInfo?: ExtraInfo[];
  countryId?: number;
}

const CreateContactService = async ({
  name,
  number,
  email = "",
  extraInfo = [],
  countryId
}: Request): Promise<Contact> => {
  // Normalizar el número: trim + remover espacios y caracteres no numéricos
  const normalizedNumber = number.trim().replace(/[^0-9]/g, "");

  // Remover el 0 después del código de país si existe (universal para códigos de 1-3 dígitos)
  // Esto normaliza números con prefijo nacional a formato internacional
  let finalNumber = normalizedNumber;
  if (normalizedNumber.length >= 10) {
    finalNumber = normalizedNumber.replace(/^(\d{1,3})0(\d{8,})$/, '$1$2');
  }

  // Buscar duplicados: exacto o con el 0 extra (para manejar casos como 5930995650094 vs 593995650094)
  const numberExists = await Contact.findOne({
    where: {
      [Op.or]: [
        { number: finalNumber },
        { number: normalizedNumber } // Por si el número original no tenía el 0 extra
      ]
    }
  });

  if (numberExists) {
    throw new AppError("ERR_DUPLICATED_CONTACT");
  }
  

  try {
    if (!countryId) {
      countryId = await getCountryIdOfNumber(number);
    }
  } catch (error) {
    console.log("---> CreateContactService | Error getting countryId of number", number, error);
  }


  const contact = await Contact.create(
    {
      name,
      number: finalNumber,
      email,
      extraInfo,
      ...(countryId && { countryId })
    },
    {
      include: ["extraInfo"]
    }
  );

  return contact;
};

export default CreateContactService;