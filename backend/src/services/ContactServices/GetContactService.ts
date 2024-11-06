import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import CheckIsValidContact from "../WbotServices/CheckIsValidContact";
import CreateContactService from "./CreateContactService";

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
}

const GetContactService = async ({
  name,
  number,
  checkIsAValidWppNumber
}: Request): Promise<Contact> => {
  const numberExists = await Contact.findOne({
    where: { number }
  });

  if (!numberExists) {
    if (checkIsAValidWppNumber) {
      await CheckIsValidContact(number);
    }

    const contact = await CreateContactService({
      name,
      number
    });

    if (contact == null) throw new AppError("CONTACT_NOT_FIND");
    else return contact;
  }

  return numberExists;
};

export default GetContactService;
