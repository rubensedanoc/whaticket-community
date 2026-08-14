import Contact from "../../models/Contact";
import * as Sentry from "@sentry/node";
import UpdateContactService, { ContactData } from "./UpdateContactService";
import Ticket from "../../models/Ticket";
import ShowTicketService from "../TicketServices/ShowTicketService";
import { emitEvent } from "../../libs/emitEvent";
import ContactClientelicencia from "../../models/ContactClientelicencias";

interface Request {
  contactId: number | string;
}

const SearchContactInformationFromTrazaService = async ({
  contactId,
}: Request): Promise<boolean> => {

  console.log("--- SearchContactInformationFromTrazaService: contactId", contactId);

  if (!contactId) {
    console.log("--- SearchContactInformationFromTrazaService: No contactId provided");
    return false;
  }

  const contact = await Contact.findOne({
    where: { id: contactId },
    attributes: ["id"],
    include: [{
      model: ContactClientelicencia,
      as: "contactClientelicencias",
      order: [["createdAt", "DESC"]],
      required: true,
      separate: true,
    }]
  });

  if (!contact) {
    console.log("--- SearchContactInformationFromTrazaService: No contact found with id", contactId);
    return false;
  }

  if (!contact.contactClientelicencias || contact.contactClientelicencias.length === 0) {
    console.log("--- SearchContactInformationFromTrazaService: No traza_clientelicencia_id found for contact", contactId);
    return false;
  }

  const lastContactClientelicencia = contact.contactClientelicencias[0];

  const result = await fetch(
    "https://web.restaurant.pe/trazabilidad/public/rest/cliente/getClienteLicenciaById/" + lastContactClientelicencia.traza_clientelicencia_id,
  );

  if (!result.ok) {
    console.error("--- SearchContactInformationFromTrazaService: Error fetching contact information from external service: ", result, " - url: ", "https://web.restaurant.pe/trazabilidad/public/rest/cliente/getClienteLicenciaById/" + lastContactClientelicencia.traza_clientelicencia_id);
    Sentry.captureException(result);
    return false;
  }

  const data = await result.json();

  console.log("--- SearchContactInformationFromTrazaService: Updating contact with data from Traza", data);

  const rawEtapaId = data?.datos?.clientelicencia_currentetapaid;
  const hasNumericEtapaValue =
    (typeof rawEtapaId === "number" || typeof rawEtapaId === "string") &&
    String(rawEtapaId).trim() !== "";
  const parsedEtapaId = hasNumericEtapaValue ? Number(rawEtapaId) : NaN;

  if (!Number.isInteger(parsedEtapaId) || parsedEtapaId <= 0) {
    console.warn(
      "--- SearchContactInformationFromTrazaService: Invalid etapa received from Traza",
      rawEtapaId
    );
    return false;
  }

  const contactData: ContactData = {
    traza_clientelicencia_currentetapaid: parsedEtapaId
  };

  try {
    await UpdateContactService({
      contactId: String(contactId),
      contactData,
      skipTrazaSync: true
    });
  } catch (error) {
    console.error(
      "--- SearchContactInformationFromTrazaService: Error updating contact",
      error
    );
    return false;
  }

  const ticketsToUpdate = await Ticket.findAll({
    where: {
      contactId
    }
  });

  // El procesamiento secuencial evita saturar la BD y aísla cada emit.
  // eslint-disable-next-line no-restricted-syntax
  for (const ticket of ticketsToUpdate) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const ticketWithAllData = await ShowTicketService(ticket.id, true);

      emitEvent({
        to: [ticket.status],
        event: {
          name: "ticket",
          data: {
            action: "update",
            ticket: ticketWithAllData
          }
        }
      });
    } catch (error) {
      console.error(
        `--- SearchContactInformationFromTrazaService: Error emitting ticket ${ticket.id}`,
        error
      );
    }
  }

  return true;
};

export default SearchContactInformationFromTrazaService;
