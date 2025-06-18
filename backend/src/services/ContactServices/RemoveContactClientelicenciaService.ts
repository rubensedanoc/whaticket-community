import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import ContactClientelicencia from "../../models/ContactClientelicencias";
import ContactCustomField from "../../models/ContactCustomField";
import SearchContactInformationFromTrazaService from "./SearchContactInformationFromTrazaService";

export interface ContactData {
  traza_clientelicencia_id?: number;
}

interface Request {
  contactData: ContactData;
  contactId: string;
}

const RemoveContactClientelicenciaService = async ({
  contactData,
  contactId
}: Request): Promise<Contact> => {
  const { traza_clientelicencia_id } =
    contactData;

  const contact = await Contact.findOne({
    where: { id: contactId },
    attributes: ["id", "name", "number", "email", "profilePicUrl"],
    include: ["extraInfo", "contactClientelicencias"]
  });

  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  console.log("--- RemoveContactClientelicenciaService: Removing contact clientelicencia", {
    contactId: contact.id,
    traza_clientelicencia_id: traza_clientelicencia_id
  });


  const contactClientelicencia = await ContactClientelicencia.findOne({
    where: {
      contactId: contact.id,
      traza_clientelicencia_id: traza_clientelicencia_id
    }
  })

  if (!contactClientelicencia) {
    throw new AppError("ERR_NO_CONTACT_CLIENTELICENCIA_FOUND", 404);
  }

  await contactClientelicencia.destroy();

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
      "traza_clientelicencia_currentetapaid",
    ],
    include: [
      "extraInfo",
      "contactClientelicencias"
    ]
  });

  try {
    SearchContactInformationFromTrazaService({
      contactId: contact.id
    })
  } catch (error) {
    console.log("--- UpdateContactService: Error searching contact information from Traza", error);
  }

  return contact;
};

export default RemoveContactClientelicenciaService;
