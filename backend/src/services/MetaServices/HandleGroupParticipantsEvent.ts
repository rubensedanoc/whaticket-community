import * as Sentry from "@sentry/node";
import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import { MetaGroupParticipantsEvent } from "../../types/meta/MetaGroupWebhookTypes";

const handleParticipantsEvent = async (
  event: MetaGroupParticipantsEvent,
  whatsapp: Whatsapp
): Promise<void> => {
  try {
    console.log(`[GroupParticipants] ${event.type} - Group: ${event.group_id}`);

    const groupContact = await Contact.findOne({
      where: {
        number: event.group_id,
        isGroup: true
      }
    });

    if (!groupContact) {
      console.warn(`[GroupParticipants] Grupo no encontrado: ${event.group_id}`);
      return;
    }

    switch (event.type) {
      case "group_participants_add":
        await handleParticipantsAdd(event, groupContact);
        break;
      case "group_participants_remove":
        await handleParticipantsRemove(event, groupContact);
        break;
      case "group_join_request_created":
        await handleJoinRequest(event, groupContact);
        break;
      case "group_join_request_revoked":
        await handleJoinRequestRevoked(event, groupContact);
        break;
    }

  } catch (err) {
    console.error(`[GroupParticipants] Error en ${event.type}:`, err);
    Sentry.captureException(err);
  }
};

const handleParticipantsAdd = async (
  event: MetaGroupParticipantsEvent,
  groupContact: Contact
): Promise<void> => {
  const participants = event.added_participants || [];
  console.log(`[ParticipantsAdd] ${participants.length} participantes agregados al grupo ${groupContact.name}`);

  for (const participant of participants) {
    console.log(`[ParticipantsAdd] Participante: ${participant.wa_id || participant.input}`);
  }
};

const handleParticipantsRemove = async (
  event: MetaGroupParticipantsEvent,
  groupContact: Contact
): Promise<void> => {
  const participants = event.removed_participants || [];
  const initiator = event.initiated_by || "unknown";

  console.log(`[ParticipantsRemove] ${participants.length} participantes removidos (iniciado por: ${initiator})`);

  if (event.failed_participants && event.failed_participants.length > 0) {
    console.warn(`[ParticipantsRemove] ${event.failed_participants.length} participantes fallaron al remover`);
  }
};

const handleJoinRequest = async (
  event: MetaGroupParticipantsEvent,
  groupContact: Contact
): Promise<void> => {
  console.log(`[JoinRequest] Solicitud de ${event.wa_id} para unirse al grupo ${groupContact.name}`);
};

const handleJoinRequestRevoked = async (
  event: MetaGroupParticipantsEvent,
  groupContact: Contact
): Promise<void> => {
  console.log(`[JoinRequestRevoked] ${event.wa_id} canceló solicitud para unirse`);
};

export default handleParticipantsEvent;
