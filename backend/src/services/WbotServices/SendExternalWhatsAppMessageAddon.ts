import { MessageMedia } from "whatsapp-web.js";
import { getWbot } from "../../libs/wbot";
import SendMessageRequest from "../../models/SendMessageRequest";
import Whatsapp from "../../models/Whatsapp";

const ELIGIBLE_CONNECTION_STATES = ["CONNECTED", "PAIRING"];
const VALID_WBOT_STATES = ["CONNECTED", "PAIRING", "OPENING"];

let currentIndex = 0;

const normalizePhoneNumber = (phoneNumber: string): string => {
  return phoneNumber.replace(/\D/g, "").trim();
};

const getEligibleConnections = async (): Promise<Whatsapp[]> => {
  const activeConnections = await Whatsapp.findAll({
    where: { status: ELIGIBLE_CONNECTION_STATES },
    order: [["id", "ASC"]]
  });

  const eligible: Whatsapp[] = [];
  for (const connection of activeConnections) {
    const wbot = getWbot(connection.id);
    if ((wbot as any)?.info) {
      eligible.push(connection);
    }
  }
  return eligible;
};

const getNextConnection = (connections: Whatsapp[]): Whatsapp => {
  const nextIndex = currentIndex % connections.length;
  currentIndex = (nextIndex + 1) % connections.length;
  return connections[nextIndex];
};

const SendExternalWhatsAppMessageAddon = async ({
  toNumber,
  message,
  mediaUrl = null
}: {
  toNumber: string;
  message: string;
  mediaUrl?: string | null;
}) => {
  const result: {
    wasOk: boolean;
    data: any;
    logs: string[];
    errors: string[];
  } = {
    wasOk: true,
    data: null,
    logs: [],
    errors: []
  };

  let sendMessageRequest: SendMessageRequest | null = null;

  try {
    if (!toNumber || typeof toNumber !== "string") {
      throw new Error("ERR_INVALID_TO_NUMBER");
    }
    if (!message || typeof message !== "string") {
      throw new Error("ERR_INVALID_MESSAGE");
    }

    const cleanToNumber = normalizePhoneNumber(toNumber);
    if (isNaN(Number(cleanToNumber))) {
      throw new Error("ERR_INVALID_TO_NUMBER");
    }

    const connections = await getEligibleConnections();
    if (!connections.length) {
      throw new Error("ERR_NO_ELIGIBLE_CONNECTION");
    }

    const selectedConnection = getNextConnection(connections);
    const fromNumber = normalizePhoneNumber(selectedConnection.number);
    result.logs.push(`[wbot-addon] Conexion seleccionada: ${fromNumber}`);

    const wbot = getWbot(selectedConnection.id);

    const wbotState = await wbot.getState();
    if (!VALID_WBOT_STATES.includes(wbotState)) {
      throw new Error(`ERR_INVALID_STATE: ${wbotState}`);
    }
    result.logs.push(`[wbot-addon] Estado valido: ${wbotState}`);

    if ((wbot as any)?.pupPage && !(wbot as any).pupPage.isClosed()) {
      const patchStatus = await (wbot as any).pupPage.evaluate(() => {
        return {
          applied: !!(window as any).__whaticket_patch_applied,
          wwebjsExists: typeof (window as any).WWebJS !== "undefined",
          getChatExists: typeof (window as any).WWebJS?.getChat === "function"
        };
      });

      if (!patchStatus.applied || !patchStatus.wwebjsExists || !patchStatus.getChatExists) {
        throw new Error("ERR_PATCHES_NOT_APPLIED");
      }
      result.logs.push("[wbot-addon] Patches validados correctamente");
    } else {
      throw new Error("ERR_PUPPAGE_NOT_AVAILABLE");
    }

    sendMessageRequest = await SendMessageRequest.create({
      fromNumber,
      toNumber: cleanToNumber,
      message
    });

    const sendMessageToId = async (destinationId: string) => {
      if (mediaUrl) {
        const media = await MessageMedia.fromUrl(mediaUrl);
        return wbot.sendMessage(destinationId, media, {
          caption: message,
          linkPreview: false
        });
      }
      return wbot.sendMessage(destinationId, message, {
        linkPreview: false
      });
    };

    const refreshAndValidate = async (msg: any) => {
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        const updatedMessage = await wbot.getMessageById(msg.id._serialized);
        if (updatedMessage) return updatedMessage;
      } catch (refreshError) {
        result.logs.push(`[wbot-addon] No se pudo refrescar mensaje: ${(refreshError as any)?.message}`);
      }

      return msg;
    };

    let sentMessage;
    let usedDestinationId = `${cleanToNumber}@c.us`;

    try {
      result.logs.push(`[wbot-addon] Enviando a @c.us: ${usedDestinationId}`);
      sentMessage = await sendMessageToId(usedDestinationId);
      sentMessage = await refreshAndValidate(sentMessage);
    } catch (firstSendError) {
      result.logs.push(`[wbot-addon] Fallo envio inicial a @c.us: ${(firstSendError as any)?.message}`);
      sentMessage = null;
    }

    if (!sentMessage || sentMessage.ack === -1) {
      const numberId = await wbot.getNumberId(`${cleanToNumber}@c.us`);
      if (!numberId) {
        throw new Error(`ERR_NUMBER_NOT_FOUND: ${cleanToNumber}`);
      }

      const lidDestinationId = numberId._serialized;
      if (lidDestinationId !== usedDestinationId) {
        usedDestinationId = lidDestinationId;
        result.logs.push(`[wbot-addon] Reintentando con ID alternativo: ${usedDestinationId}`);
        sentMessage = await sendMessageToId(usedDestinationId);
        sentMessage = await refreshAndValidate(sentMessage);
      }
    }

    if (!sentMessage || sentMessage.ack === -1) {
      throw new Error("ERR_ACK_REJECTED");
    }

    result.logs.push(`[wbot-addon] Mensaje enviado - ACK: ${sentMessage.ack} (${usedDestinationId})`);
    result.data = sentMessage;

    await sendMessageRequest.update({ status: "sent" });

  } catch (error: any) {
    result.wasOk = false;
    result.errors.push(error?.message || "ERR_UNKNOWN");
    result.logs.push(`[wbot-addon] Error: ${error?.message}`);

    if (sendMessageRequest) {
      await sendMessageRequest.update({ status: "failed" });
    }
  }

  return result;
};

export default SendExternalWhatsAppMessageAddon;
