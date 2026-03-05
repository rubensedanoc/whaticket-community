import { MetaApiClient } from "../../clients/MetaApiClient";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";

interface SendChatbotTimeoutMessageMetaParams {
  ticket: Ticket;
  contact: Contact;
  whatsapp: Whatsapp;
}

const SendChatbotTimeoutMessageMeta = async ({
  ticket,
  contact,
  whatsapp
}: SendChatbotTimeoutMessageMetaParams): Promise<void> => {
  try {
    console.log(`[SendChatbotTimeoutMessageMeta] Enviando mensaje de timeout para ticket ${ticket.id}`);

    const message = "⏱️ Tu sesión ha expirado por inactividad. Si necesitas ayuda, escríbeme de nuevo y con gusto te atenderé. 😊";

    const client = new MetaApiClient({
      phoneNumberId: whatsapp.phoneNumberId,
      accessToken: whatsapp.metaAccessToken
    });

    const response = await client.sendText({
      to: contact.number,
      body: message
    });

    const messageId = response.messages[0].id;

    await Message.create({
      id: messageId,
      ticketId: ticket.id,
      contactId: contact.id,
      body: message,
      fromMe: true,
      mediaType: "chat",
      read: true,
      quotedMsgId: null,
      ack: 3
    });

    console.log(`[SendChatbotTimeoutMessageMeta] Mensaje de sesion expirado de bot enviado exitosamente`);
  } catch (error) {
    console.error(`[SendChatbotTimeoutMessageMeta] Error:`, error);
  }
};

export default SendChatbotTimeoutMessageMeta;
