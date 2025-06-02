import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import CheckIsValidContact from "../WbotServices/CheckIsValidContact";
import CreateContactService from "./CreateContactService";

interface Request {
  number: string;
}

const GetContactByNumberService = async ({
  number,
}: Request): Promise<Contact> => {
  const numberExists = await Contact.findOne({
    where: { number }
  });

  return numberExists;
};

export default GetContactByNumberService;
