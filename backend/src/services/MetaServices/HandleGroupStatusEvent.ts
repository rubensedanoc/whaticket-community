import * as Sentry from "@sentry/node";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { MetaGroupStatusEvent } from "../../types/meta/MetaGroupWebhookTypes";

const handleStatusEvent = async (
  event: MetaGroupStatusEvent,
  whatsapp: Whatsapp
): Promise<void> => {
  try {
    console.log(`[GroupStatus] ${event.type} - Group: ${event.group_id}`);

    const groupContact = await Contact.findOne({
      where: {
        number: event.group_id,
        isGroup: true
      }
    });

    if (!groupContact) {
      console.warn(`[GroupStatus] Grupo no encontrado: ${event.group_id}`);
      return;
    }

    if (event.type === "group_suspended") {
      await groupContact.update({
        name: `[SUSPENDIDO] ${groupContact.name}`
      });

      await Ticket.update(
        { status: "closed" },
        { where: { contactId: groupContact.id } }
      );

      console.warn(`[GroupStatus] Grupo suspendido: ${groupContact.name}`);
      if (event.reason) {
        console.warn(`[GroupStatus] Razón: ${event.reason}`);
      }

    } else if (event.type === "group_unsuspended") {
      const cleanName = groupContact.name.replace('[SUSPENDIDO] ', '');
      await groupContact.update({ name: cleanName });

      console.log(`[GroupStatus] Grupo reactivado: ${cleanName}`);
    }

  } catch (err) {
    console.error("[GroupStatus] Error:", err);
    Sentry.captureException(err);
  }
};

export default handleStatusEvent;
