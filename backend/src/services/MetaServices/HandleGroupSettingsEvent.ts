import * as Sentry from "@sentry/node";
import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import { MetaGroupSettingsEvent } from "../../types/meta/MetaGroupWebhookTypes";

const handleSettingsEvent = async (
  event: MetaGroupSettingsEvent,
  whatsapp: Whatsapp
): Promise<void> => {
  try {
    console.log(`[GroupSettings] Update - Group: ${event.group_id}`);

    const groupContact = await Contact.findOne({
      where: {
        number: event.group_id,
        isGroup: true
      }
    });

    if (!groupContact) {
      console.warn(`[GroupSettings] Grupo no encontrado: ${event.group_id}`);
      return;
    }

    if (event.group_subject?.update_successful) {
      await groupContact.update({
        name: event.group_subject.text
      });
      console.log(`[GroupSettings] Nombre actualizado: ${event.group_subject.text}`);
    }

    if (event.group_description?.update_successful) {
      await groupContact.update({
        extraInfo: [{ description: event.group_description.text }]
      });
      console.log(`[GroupSettings] Descripción actualizada`);
    }

    if (event.profile_picture?.update_successful) {
      console.log(`[GroupSettings] Foto de perfil actualizada (sha256: ${event.profile_picture.sha256})`);
    }

    if (event.errors && event.errors.length > 0) {
      console.error(`[GroupSettings] Errores en actualización: ${event.errors[0].message}`);
    }

  } catch (err) {
    console.error("[GroupSettings] Error:", err);
    Sentry.captureException(err);
  }
};

export default handleSettingsEvent;
