import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import CheckIsValidContact from "../WbotServices/CheckIsValidContact";
import CreateContactService from "./CreateContactService";
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
  checkIsAValidWppNumber?: boolean;
  whatsappId?: number;
}

const GetContactService = async ({
  name,
  number,
  checkIsAValidWppNumber,
  whatsappId
}: Request): Promise<Contact> => {
  // El número se normaliza antes de buscar: así "987654321" encuentra al contacto
  // "51987654321" que ya existe, en vez de crear un duplicado.
  const resolved = await ResolveContactNumberService({ number, whatsappId });

  const possibleNumbers = [resolved.number, String(number).replace(/\D/g, "")];

  const numberExists = await Contact.findOne({
    where: { number: { [Op.in]: possibleNumbers } }
  });

  if (!numberExists) {
    if (checkIsAValidWppNumber) {
      await CheckIsValidContact(resolved.number);
    }

    const contact = await CreateContactService({
      name,
      number: resolved.number,
      whatsappId,
      askWhatsapp: false
    });

    if (contact == null) throw new AppError("CONTACT_NOT_FIND");
    else return contact;
  }

  return numberExists;
};

export default GetContactService;
