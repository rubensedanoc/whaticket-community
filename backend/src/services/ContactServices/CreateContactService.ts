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
  const numberExists = await Contact.findOne({
    where: { number }
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
      number,
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