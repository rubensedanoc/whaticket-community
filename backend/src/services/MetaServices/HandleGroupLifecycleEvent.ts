import * as Sentry from "@sentry/node";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { MetaGroupLifecycleEvent } from "../../types/meta/MetaGroupWebhookTypes";
import { emitEvent } from "../../libs/emitEvent";

const handleLifecycleEvent = async (
  event: MetaGroupLifecycleEvent,
  whatsapp: Whatsapp
): Promise<void> => {
  try {
    console.log(`[GroupLifecycle] ${event.type} - Group: ${event.group_id}`);

    if (event.type === "group_create") {
      await handleGroupCreate(event, whatsapp);
    } else if (event.type === "group_delete") {
      await handleGroupDelete(event, whatsapp);
    }

  } catch (err) {
    console.error(`[GroupLifecycle] Error en ${event.type}:`, err);
    Sentry.captureException(err);
  }
};

const handleGroupCreate = async (
  event: MetaGroupLifecycleEvent,
  whatsapp: Whatsapp
): Promise<void> => {
  if (event.errors && event.errors.length > 0) {
    console.error(`[GroupCreate] Error: ${event.errors[0].message}`);
    return;
  }

  const existingGroup = await Contact.findOne({
    where: {
      number: event.group_id,
      isGroup: true
    }
  });

  if (existingGroup) {
    console.log(`[GroupCreate] Grupo ya existe: ${existingGroup.id}`);
    return;
  }

  const groupContact = await Contact.create({
    name: event.subject || `Grupo ${event.group_id}`,
    number: event.group_id,
    isGroup: true,
    email: "",
    extraInfo: event.description ? [{ description: event.description }] : []
  });

  console.log(`[GroupCreate] Contacto creado: ${groupContact.id}`);

  const ticket = await Ticket.create({
    contactId: groupContact.id,
    whatsappId: whatsapp.id,
    status: "closed",
    isGroup: true,
    unreadMessages: 0,
    lastMessageTimestamp: parseInt(event.timestamp)
  });

  console.log(`[GroupCreate] Ticket creado: ${ticket.id}`);

  emitEvent({
    to: ["admin"],
    event: {
      name: "group",
      data: {
        action: "create",
        group: groupContact,
        inviteLink: event.invite_link
      }
    }
  });
};

const handleGroupDelete = async (
  event: MetaGroupLifecycleEvent,
  whatsapp: Whatsapp
): Promise<void> => {
  if (event.errors && event.errors.length > 0) {
    console.error(`[GroupDelete] Error: ${event.errors[0].message}`);
    return;
  }

  const groupContact = await Contact.findOne({
    where: {
      number: event.group_id,
      isGroup: true
    }
  });

  if (!groupContact) {
    console.warn(`[GroupDelete] Grupo no encontrado: ${event.group_id}`);
    return;
  }

  await Ticket.update(
    { status: "closed" },
    { where: { contactId: groupContact.id } }
  );

  await groupContact.update({ 
    name: `[ELIMINADO] ${groupContact.name}`
  });

  console.log(`[GroupDelete] Grupo marcado como eliminado: ${groupContact.id}`);

  emitEvent({
    to: ["admin"],
    event: {
      name: "group",
      data: {
        action: "delete",
        groupId: groupContact.id
      }
    }
  });
};

export default handleLifecycleEvent;
