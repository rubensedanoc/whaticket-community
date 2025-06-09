import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import ContactCustomField from "../../models/ContactCustomField";
import SearchContactInformationFromTrazaService from "./SearchContactInformationFromTrazaService";

interface ExtraInfo {
  id?: number;
  name: string;
  value: string;
}
export interface ContactData {
  email?: string;
  number?: string;
  name?: string;
  domain?: string;
  countryId?: number;
  extraInfo?: ExtraInfo[];
  isCompanyMember?: boolean;
  isExclusive?: boolean;
  traza_clientelicencia_id?: number;
  traza_clientelicencia_currentetapaid?: number;
}

interface Request {
  contactData: ContactData;
  contactId: string;
}

const UpdateContactService = async ({
  contactData,
  contactId
}: Request): Promise<Contact> => {
  const { email, name, number, extraInfo, domain, isCompanyMember, countryId, isExclusive, traza_clientelicencia_id, traza_clientelicencia_currentetapaid } =
    contactData;

  const contact = await Contact.findOne({
    where: { id: contactId },
    attributes: ["id", "name", "number", "email", "profilePicUrl"],
    include: ["extraInfo"]
  });

  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  if (extraInfo) {
    await Promise.all(
      extraInfo.map(async info => {
        await ContactCustomField.upsert({ ...info, contactId: contact.id });
      })
    );

    await Promise.all(
      contact.extraInfo.map(async oldInfo => {
        const stillExists = extraInfo.findIndex(info => info.id === oldInfo.id);

        if (stillExists === -1) {
          await ContactCustomField.destroy({ where: { id: oldInfo.id } });
        }
      })
    );
  }

  await contact.update({
    name,
    // number, dont update number never
    email,
    domain,
    isCompanyMember,
    isExclusive,
    countryId,
    traza_clientelicencia_id,
    traza_clientelicencia_currentetapaid
  });

  await contact.reload({
    attributes: [
      "id",
      "name",
      "number",
      "email",
      "domain",
      "profilePicUrl",
      "isCompanyMember",
      "isExclusive",
      "countryId",
      "traza_clientelicencia_id",
      "traza_clientelicencia_currentetapaid"
    ],
    include: ["extraInfo"]
  });

  if (traza_clientelicencia_id) {
    try {
      SearchContactInformationFromTrazaService({
        contactId: contact.id
      })
    } catch (error) {
      console.log("--- UpdateContactService: Error searching contact information from Traza", error);
    }
  }

  return contact;
};

export default UpdateContactService;
