import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import ResolveContactNumberService from "./ResolveContactNumberService";

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
  /** Conexión cuyo país se usa para completar números en formato nacional. */
  whatsappId?: number;
  /** Consultar a WhatsApp por el número canónico. */
  askWhatsapp?: boolean;
}

const CreateContactService = async ({
  name,
  number,
  email = "",
  extraInfo = [],
  countryId,
  whatsappId,
  askWhatsapp = true
}: Request): Promise<Contact> => {
  // Todo contacto se guarda con prefijo de país. Si el número no se puede resolver,
  // ResolveContactNumberService lanza ERR_CONTACT_NUMBER_WITHOUT_COUNTRY_CODE y el
  // contacto no se crea: así no se generan duplicados del tipo 987654321 / 51987654321.
  const resolved = await ResolveContactNumberService({
    number,
    whatsappId,
    askWhatsapp
  });

  const finalNumber = resolved.number;

  // Se busca también la forma nacional (sin prefijo) para no crear un segundo contacto
  // cuando el histórico todavía tiene la variante vieja del mismo número.
  const possibleNumbers = [finalNumber];

  if (resolved.countryCode && finalNumber.startsWith(resolved.countryCode)) {
    possibleNumbers.push(finalNumber.slice(resolved.countryCode.length));
  }

  const numberExists = await Contact.findOne({
    where: { number: { [Op.in]: possibleNumbers } }
  });

  if (numberExists) {
    throw new AppError("ERR_DUPLICATED_CONTACT");
  }

  const contact = await Contact.create(
    {
      name,
      number: finalNumber,
      email,
      extraInfo,
      ...((countryId || resolved.countryId) && {
        countryId: countryId || resolved.countryId
      })
    },
    {
      include: ["extraInfo"]
    }
  );

  return contact;
};

export default CreateContactService;
