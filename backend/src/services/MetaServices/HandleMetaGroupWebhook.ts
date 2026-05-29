import * as Sentry from "@sentry/node";
import Whatsapp from "../../models/Whatsapp";
import { 
  MetaGroupWebhookPayload, 
  MetaGroupWebhookField,
  MetaGroupEvent,
  isGroupLifecycleEvent,
  isGroupParticipantsEvent,
  isGroupSettingsEvent,
  isGroupStatusEvent
} from "../../types/meta/MetaGroupWebhookTypes";
import handleLifecycleEvent from "./HandleGroupLifecycleEvent";
import handleParticipantsEvent from "./HandleGroupParticipantsEvent";
import handleSettingsEvent from "./HandleGroupSettingsEvent";
import handleStatusEvent from "./HandleGroupStatusEvent";

interface HandleMetaGroupWebhookParams {
  payload: MetaGroupWebhookPayload;
}

const HandleMetaGroupWebhook = async ({ payload }: HandleMetaGroupWebhookParams): Promise<void> => {
  try {
    console.log("[HandleMetaGroupWebhook] Procesando webhook de grupo");

    const entry = payload.entry[0];
    const change = entry.changes[0];
    const field = change.field;
    const value = change.value;

    const whatsapp = await Whatsapp.findOne({
      where: { phoneNumberId: value.metadata.phone_number_id }
    });

    if (!whatsapp) {
      console.warn(`[HandleMetaGroupWebhook] WhatsApp no encontrado: ${value.metadata.phone_number_id}`);
      return;
    }

    if (!value.groups || value.groups.length === 0) {
      console.log("[HandleMetaGroupWebhook] No hay eventos de grupo para procesar");
      return;
    }

    for (const groupEvent of value.groups) {
      await processGroupEvent(field, groupEvent, whatsapp);
    }

  } catch (err) {
    console.error("[HandleMetaGroupWebhook] Error:", err);
    Sentry.captureException(err);
  }
};

const processGroupEvent = async (
  field: MetaGroupWebhookField,
  event: MetaGroupEvent,
  whatsapp: Whatsapp
): Promise<void> => {
  try {
    console.log(`[HandleMetaGroupWebhook] Procesando evento: ${field} - ${event.type}`);

    if (isGroupLifecycleEvent(event)) {
      await handleLifecycleEvent(event, whatsapp);
    } else if (isGroupParticipantsEvent(event)) {
      await handleParticipantsEvent(event, whatsapp);
    } else if (isGroupSettingsEvent(event)) {
      await handleSettingsEvent(event, whatsapp);
    } else if (isGroupStatusEvent(event)) {
      await handleStatusEvent(event, whatsapp);
    }

  } catch (err) {
    console.error(`[HandleMetaGroupWebhook] Error procesando evento ${event.type}:`, err);
    Sentry.captureException(err);
  }
};

export default HandleMetaGroupWebhook;
