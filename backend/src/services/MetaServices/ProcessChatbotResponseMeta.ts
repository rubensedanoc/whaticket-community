import * as Sentry from "@sentry/node";
import ChatbotMessage from "../../models/ChatbotMessage";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { MetaApiClient } from "../../clients/MetaApiClient";
import { emitEvent } from "../../libs/emitEvent";
import {
  NAV_BACK_ID,
  NAV_HOME_ID,
  INCIDENCIA_CONFIRM_ID,
  INCIDENCIA_CANCEL_ID,
  INCIDENCIA_RETRY_ID,
  INCIDENCIA_RESOLVED_ID,
  appendNavigationRows,
  resolveNavigationTarget
} from "../ChatbotMessageService/ChatbotNavigationHelper";
import {
  buildIncidenciaPath,
  popIncidenciaPath,
  isRealLeafNode,
  getIncidenciaResetFields
} from "../ChatbotMessageService/IncidenciaFlowHelper";
import CreateIncidenciaService from "../IncidenciaService/CreateIncidenciaService";

interface InteractiveListRow {
  id: string;
  title: string;
  description?: string;
  label?: string;
}

const formatInteractiveListOptionsAsText = (rows: InteractiveListRow[]): string => {
  if (!rows || rows.length === 0) return "";

  const optionsText = rows.map((row) => {
    const prefix = row.label || row.id;
    if (row.description) {
      return `${prefix}. ${row.title}: ${row.description}`;
    }
    return `${prefix}. ${row.title}`;
  }).join("\n");

  return `\n\n${optionsText}`;
};

const CONTENTION_COOLDOWN_MS = 1 * 60 * 1000; // 1 minuto

/**
 * Resetea la incidencia y navega al menú raíz del chatbot.
 * Reutilizado por NAV_HOME y INCIDENCIA_NEW desde el interceptor de incidencia completada.
 */
const resetIncidenciaAndNavigateHome = async (
  ticket: Ticket,
  contact: Contact,
  whatsapp: Whatsapp,
  reason: string
): Promise<void> => {
  await ticket.update({
    ...getIncidenciaResetFields(),
    chatbotSelectedCategory: null
  });
  console.log(`[ProcessChatbotResponseMeta] Incidencia reseteada por: ${reason}`);

  const navResult = await resolveNavigationTarget(
    "home",
    ticket.chatbotMessageLastStep || ticket.chatbotMessageIdentifier,
    ticket.chatbotMessageIdentifier
  );
  if (!navResult) return;

  const { targetNode, newLastStep } = navResult;
  await ticket.update({ chatbotMessageLastStep: newLastStep });

  if (targetNode.hasSubOptions && targetNode.chatbotOptions && targetNode.chatbotOptions.length > 0) {
    const client = new MetaApiClient({ phoneNumberId: whatsapp.phoneNumberId, accessToken: whatsapp.metaAccessToken });
    let rows: InteractiveListRow[] = targetNode.chatbotOptions.map(option => {
      const fullText = option.title.trim();
      if (fullText.includes(':')) {
        const [beforeColon, afterColon] = fullText.split(':').map(s => s.trim());
        return { id: option.id.toString(), title: beforeColon.substring(0, 24), description: afterColon ? afterColon.substring(0, 72) : undefined, label: option.label };
      }
      if (fullText.length <= 24) return { id: option.id.toString(), title: fullText, label: option.label };
      return { id: option.id.toString(), title: fullText.substring(0, 24), description: fullText.substring(24, 96), label: option.label };
    });
    rows = await appendNavigationRows(rows, targetNode, newLastStep, ticket.chatbotMessageIdentifier);
    const rowsForMeta = rows.map(({ label, ...row }) => row);
    const resp = await client.sendInteractiveList({ to: contact.number, bodyText: `\u200e${targetNode.value}`, buttonText: "Ver opciones", sections: [{ rows: rowsForMeta }] });
    const optionsText = formatInteractiveListOptionsAsText(rows);
    const msg = await Message.create({
      id: resp.messages[0].id, ticketId: ticket.id, contactId: contact.id,
      body: `\u200e${targetNode.value}${optionsText}`, fromMe: true, mediaType: "chat",
      read: true, quotedMsgId: null, timestamp: Math.floor(Date.now() / 1000), ack: 3,
      identifier: targetNode.identifier
    });
    await ticket.update({ lastMessage: msg.body });
    emitEvent({ to: [ticket.id.toString(), ticket.status], event: { name: "appMessage", data: { action: "create", message: msg, ticket, contact } } });
  }
};

interface ProcessChatbotResponseMetaParams {
  ticket: Ticket;
  userMessage: string;
  contact: Contact;
  whatsapp: Whatsapp;
  selectedOptionId?: string;
}

const ProcessChatbotResponseMeta = async ({
  ticket,
  userMessage,
  contact,
  whatsapp,
  selectedOptionId
}: ProcessChatbotResponseMetaParams): Promise<void> => {
  try {
    console.log(`[ProcessChatbotResponseMeta] Procesando respuesta para ticket ${ticket.id}: "${userMessage}"`);

    if (!ticket.chatbotMessageIdentifier) {
      console.log("[ProcessChatbotResponseMeta] Ticket no está en modo chatbot, ignorando");
      return;
    }

    // Buscar el mensaje actual del chatbot (replica wbotMessageListener.ts:929-943)
    const chatbotMessageReplied = await ChatbotMessage.findOne({
      where: {
        identifier: ticket.chatbotMessageLastStep || ticket.chatbotMessageIdentifier
      },
      include: [
        {
          model: ChatbotMessage,
          as: "chatbotOptions",
          where: { wasDeleted: false },
          required: false,
          separate: true,
          order: [["order", "ASC"]]
        }
      ]
    });

    if (!chatbotMessageReplied) {
      console.error(`[ProcessChatbotResponseMeta] No se encontró mensaje del chatbot con identifier: ${ticket.chatbotMessageLastStep || ticket.chatbotMessageIdentifier}`);
      return;
    }

    console.log(`[ProcessChatbotResponseMeta] Mensaje actual del chatbot: ${chatbotMessageReplied.identifier}, opciones: ${chatbotMessageReplied.chatbotOptions?.length || 0}`);

    // ── Interceptar comandos de navegación (Volver / Menú principal) ──
    if (selectedOptionId === NAV_BACK_ID || selectedOptionId === NAV_HOME_ID) {
      const navAction = selectedOptionId === NAV_BACK_ID ? "back" : "home";
      const currentIdentifier = ticket.chatbotMessageLastStep || ticket.chatbotMessageIdentifier;

      console.log(`[ProcessChatbotResponseMeta] Navegación detectada: "${navAction}" desde ${currentIdentifier}`);

      // Manejar estado de incidencia durante navegación
      if (ticket.incidenciaFlowActive) {
        if (navAction === "home") {
          // Resetear todo el flujo de incidencia al ir al menú principal
          await ticket.update(getIncidenciaResetFields());
          console.log(`[ProcessChatbotResponseMeta] Flujo de incidencia reseteado por navegación a home`);
        } else if (navAction === "back") {
          // Quitar último elemento de la ruta
          const updatedPath = popIncidenciaPath(ticket.incidenciaPathJson);
          await ticket.update({
            incidenciaPathJson: updatedPath,
            incidenciaStatus: "idle",
            // Si ya no hay ruta, desactivar el flujo
            ...(!updatedPath && { incidenciaFlowActive: false })
          });
          console.log(`[ProcessChatbotResponseMeta] Incidencia path actualizado por back: ${updatedPath}`);
        }
      }

      const navResult = await resolveNavigationTarget(navAction, currentIdentifier, ticket.chatbotMessageIdentifier);

      if (navResult) {
        const { targetNode, newLastStep } = navResult;

        await ticket.update({ chatbotMessageLastStep: newLastStep });

        // Enviar el menú del nodo destino
        if (targetNode.hasSubOptions && targetNode.chatbotOptions && targetNode.chatbotOptions.length > 0) {
          const client = new MetaApiClient({
            phoneNumberId: whatsapp.phoneNumberId,
            accessToken: whatsapp.metaAccessToken
          });

          let rows: InteractiveListRow[] = targetNode.chatbotOptions.map(option => {
            const fullText = option.title.trim();
            if (fullText.includes(':')) {
              const [beforeColon, afterColon] = fullText.split(':').map(s => s.trim());
              return {
                id: option.id.toString(),
                title: beforeColon.substring(0, 24),
                description: afterColon ? afterColon.substring(0, 72) : undefined,
                label: option.label
              };
            }
            if (fullText.length <= 24) {
              return { id: option.id.toString(), title: fullText, label: option.label };
            }
            return {
              id: option.id.toString(),
              title: fullText.substring(0, 24),
              description: fullText.substring(24, 96),
              label: option.label
            };
          });

          // Agregar opciones de navegación al nodo destino si aplica
          rows = await appendNavigationRows(
            rows,
            targetNode,
            newLastStep,
            ticket.chatbotMessageIdentifier
          );

          const rowsForMeta = rows.map(({ label, ...row }) => row);

          const response = await client.sendInteractiveList({
            to: contact.number,
            bodyText: `\u200e${targetNode.value}`,
            buttonText: "Ver opciones",
            sections: [{ rows: rowsForMeta }]
          });

          const navMessageId = response.messages[0].id;
          const optionsText = formatInteractiveListOptionsAsText(rows);
          const navBotMessage = await Message.create({
            id: navMessageId,
            ticketId: ticket.id,
            contactId: contact.id,
            body: `\u200e${targetNode.value}${optionsText}`,
            fromMe: true,
            mediaType: "chat",
            read: true,
            quotedMsgId: null,
            timestamp: Math.floor(Date.now() / 1000),
            ack: 3,
            identifier: targetNode.identifier
          });
          await ticket.update({ lastMessage: navBotMessage.body });

          emitEvent({
            to: [ticket.id.toString(), ticket.status],
            event: {
              name: "appMessage",
              data: { action: "create", message: navBotMessage, ticket, contact }
            }
          });
        }

        console.log(`[ProcessChatbotResponseMeta] Navegación completada a: ${navResult.targetNode.identifier}`);
        return;
      }
    }
    // ── Fin interceptar navegación ──

    // ── Interceptar estado de procesamiento (bloqueo durante creación de incidencia) ──
    if (ticket.incidenciaStatus === "processing") {
      console.log(`[ProcessChatbotResponseMeta] Incidencia en procesamiento para ticket ${ticket.id}, enviando mensaje de espera`);
      const waitClient = new MetaApiClient({
        phoneNumberId: whatsapp.phoneNumberId,
        accessToken: whatsapp.metaAccessToken
      });
      const waitBody = "⏳ Tu solicitud está siendo procesada, por favor espera un momento.";
      const waitResponse = await waitClient.sendText({ to: contact.number, body: waitBody });
      const waitMsg = await Message.create({
        id: waitResponse.messages[0].id,
        ticketId: ticket.id,
        contactId: contact.id,
        body: waitBody,
        fromMe: true,
        mediaType: "chat",
        read: true,
        quotedMsgId: null,
        timestamp: Math.floor(Date.now() / 1000),
        ack: 3
      });
      await ticket.update({ lastMessage: waitMsg.body });
      emitEvent({
        to: [ticket.id.toString(), ticket.status],
        event: { name: "appMessage", data: { action: "create", message: waitMsg, ticket, contact } }
      });
      return;
    }
    // ── Fin interceptar procesamiento ──

    // ── Interceptar incidencia completada (contención post-registro) ──
    if (ticket.incidenciaStatus === "completed" && ticket.incidenciaExternalId) {
      // Opción: "Mi problema ya fue solucionado" → cerrar ticket + despedida
      if (selectedOptionId === INCIDENCIA_RESOLVED_ID) {
        console.log(`[ProcessChatbotResponseMeta] Cliente indica problema resuelto para ticket ${ticket.id}, incidencia ${ticket.incidenciaExternalId}`);

        const resolvedClient = new MetaApiClient({ phoneNumberId: whatsapp.phoneNumberId, accessToken: whatsapp.metaAccessToken });
        const farewellBody = "👍 Perfecto, hemos cerrado tu solicitud correctamente.\nSi necesitas ayuda nuevamente puedes escribirnos en cualquier momento.";
        const farewellResp = await resolvedClient.sendText({ to: contact.number, body: farewellBody });
        const farewellMsg = await Message.create({
          id: farewellResp.messages[0].id, ticketId: ticket.id, contactId: contact.id,
          body: farewellBody, fromMe: true, mediaType: "chat",
          read: true, quotedMsgId: null, timestamp: Math.floor(Date.now() / 1000), ack: 3
        });
        await ticket.update({ lastMessage: farewellMsg.body });
        emitEvent({
          to: [ticket.id.toString(), ticket.status],
          event: { name: "appMessage", data: { action: "create", message: farewellMsg, ticket, contact } }
        });

        // Cerrar ticket y limpiar estado
        const oldStatus = ticket.status;
        await ticket.update({
          ...getIncidenciaResetFields(),
          chatbotMessageIdentifier: null,
          chatbotMessageLastStep: null,
          chatbotFinishedAt: new Date(),
          chatbotSelectedCategory: null,
          status: "closed"
        });

        emitEvent({
          to: [oldStatus],
          event: { name: "ticket", data: { action: "delete", ticketId: ticket.id } }
        });
        emitEvent({
          to: ["closed", "notification", ticket.id.toString()],
          event: { name: "ticket", data: { action: "update", ticket } }
        });

        console.log(`[ProcessChatbotResponseMeta] Ticket ${ticket.id} cerrado por cliente (problema resuelto)`);
        return;
      }

      // Cualquier otro mensaje → contención con cooldown de 1 minuto

      // Verificar cooldown
      if (ticket.incidenciaLastContentionAt) {
        const elapsed = Date.now() - new Date(ticket.incidenciaLastContentionAt).getTime();
        if (elapsed < CONTENTION_COOLDOWN_MS) {
          // Enviar un acuse de recibo breve una vez por ciclo de cooldown (contención impar = ya se envió full, toca brief)
          if ((ticket.incidenciaContentionCount || 0) % 2 === 1) {
            const briefClient = new MetaApiClient({
              phoneNumberId: whatsapp.phoneNumberId,
              accessToken: whatsapp.metaAccessToken
            });
            const briefBody = `⚠️ Entendemos la urgencia de tu caso.\nNuestro equipo ya tiene tu solicitud y será atendida en breve.\nEnviar varios mensajes no acelera la atención, pero tu caso ya está siendo gestionado.`;
            const briefRows: InteractiveListRow[] = [
              { id: INCIDENCIA_RESOLVED_ID, title: "Problema solucionado", label: INCIDENCIA_RESOLVED_ID }
            ];
            const briefRowsForMeta = briefRows.map(({ label, ...row }) => row);
            const briefResp = await briefClient.sendInteractiveList({
              to: contact.number,
              bodyText: briefBody,
              buttonText: "Ver opciones",
              sections: [{ rows: briefRowsForMeta }]
            });
            const briefOptText = formatInteractiveListOptionsAsText(briefRows);
            const briefMsg = await Message.create({
              id: briefResp.messages[0].id, ticketId: ticket.id, contactId: contact.id,
              body: `${briefBody}${briefOptText}`, fromMe: true, mediaType: "chat",
              read: true, quotedMsgId: null, timestamp: Math.floor(Date.now() / 1000), ack: 3
            });
            await ticket.update({ lastMessage: briefMsg.body });
            emitEvent({
              to: [ticket.id.toString(), ticket.status],
              event: { name: "appMessage", data: { action: "create", message: briefMsg, ticket, contact } }
            });
            await ticket.update({ incidenciaContentionCount: (ticket.incidenciaContentionCount || 0) + 1 });
            console.log(`[ProcessChatbotResponseMeta] Acuse breve enviado durante cooldown para ticket ${ticket.id}`);
          } else {
            console.log(`[ProcessChatbotResponseMeta] Cooldown activo para ticket ${ticket.id} (${Math.round(elapsed / 1000)}s desde última contención), ignorando`);
          }
          return;
        }
      }

      // Enviar mensaje de contención con variaciones para evitar repetición
      const contentionCount = (ticket.incidenciaContentionCount || 0) + 1;
      await ticket.update({
        incidenciaContentionCount: contentionCount,
        incidenciaLastContentionAt: new Date()
      });

      const contentionClient = new MetaApiClient({ phoneNumberId: whatsapp.phoneNumberId, accessToken: whatsapp.metaAccessToken });

      // Variaciones de mensaje según el número de contención
      const contentionMessages = [
        `⏳ Seguimos gestionando tu solicitud.\nTu caso ya se encuentra en la cola de atención prioritaria.\nUn asesor se comunicará contigo lo antes posible.\n\n*Si tu problema ya fue solucionado, selecciona la opción abajo.*`,
        `Tu solicitud está siendo atendida.\nNuestro equipo ya tiene tu caso y te contactará pronto.\nEnviar varios mensajes no acelera la atención.\n\n*Puedes cerrar esta solicitud usando el botón de abajo si tu problema ya fue resuelto.*`,
        `Estamos trabajando en tu solicitud.\nUn especialista se comunicará contigo en breve.\nTu caso ya está siendo gestionado.\n\n*Si ya no necesitas ayuda, usa la opción "Problema solucionado" para cerrar.*`,
        `Tu caso está en proceso.\nPronto recibirás atención de nuestro equipo.\nEnviar varios mensajes no acelera la atención, pero tu caso ya está siendo gestionado.\n\n*Recuerda: puedes cerrar esta conversación con el botón de abajo si tu problema se resolvió.*`
      ];

      const messageIndex = (contentionCount - 1) % contentionMessages.length;
      const contentionBody = contentionMessages[messageIndex];

      const contentionRows: InteractiveListRow[] = [
        { id: INCIDENCIA_RESOLVED_ID, title: "Problema solucionado", label: INCIDENCIA_RESOLVED_ID }
      ];
      const contentionRowsForMeta = contentionRows.map(({ label, ...row }) => row);
      const contentionResp = await contentionClient.sendInteractiveList({
        to: contact.number,
        bodyText: contentionBody,
        buttonText: "Ver opciones",
        sections: [{ rows: contentionRowsForMeta }]
      });
      const contentionOptText = formatInteractiveListOptionsAsText(contentionRows);
      const contentionMsg = await Message.create({
        id: contentionResp.messages[0].id, ticketId: ticket.id, contactId: contact.id,
        body: `${contentionBody}${contentionOptText}`, fromMe: true, mediaType: "chat",
        read: true, quotedMsgId: null, timestamp: Math.floor(Date.now() / 1000), ack: 3
      });
      await ticket.update({ lastMessage: contentionMsg.body });
      emitEvent({
        to: [ticket.id.toString(), ticket.status],
        event: { name: "appMessage", data: { action: "create", message: contentionMsg, ticket, contact } }
      });

      // Alerta pasiva si llevan >30 min esperando (solo la primera vez)
      const ticketAgeMs = Date.now() - new Date(ticket.createdAt).getTime();
      if (ticketAgeMs > 30 * 60 * 1000 && contentionCount === 1) {
        Sentry.captureMessage("Incidencia sin atención >30 min", {
          level: "warning" as any,
          extra: { ticketId: ticket.id, incidenciaExternalId: ticket.incidenciaExternalId, contactId: contact.id, elapsedMinutes: Math.round(ticketAgeMs / 60000) }
        });
      }

      console.log(`[ProcessChatbotResponseMeta] Contención #${contentionCount} para ticket ${ticket.id}`);
      return;
    }
    // ── Fin interceptar incidencia completada ──

    // ── Interceptar comandos de flujo de incidencia (Confirmar / Cancelar / Reintentar) ──
    if (
      selectedOptionId === INCIDENCIA_CONFIRM_ID ||
      selectedOptionId === INCIDENCIA_CANCEL_ID ||
      selectedOptionId === INCIDENCIA_RETRY_ID
    ) {
      const incClient = new MetaApiClient({
        phoneNumberId: whatsapp.phoneNumberId,
        accessToken: whatsapp.metaAccessToken
      });

      if (selectedOptionId === INCIDENCIA_CANCEL_ID) {
        console.log(`[ProcessChatbotResponseMeta] Incidencia cancelada, volviendo atrás`);
        // Quitar último elemento de la ruta
        const updatedPath = popIncidenciaPath(ticket.incidenciaPathJson);
        await ticket.update({
          incidenciaStatus: "idle",
          incidenciaPathJson: updatedPath
        });
        // Reutilizar navegación "back"
        const currentIdentifier = ticket.chatbotMessageLastStep || ticket.chatbotMessageIdentifier;
        const navResult = await resolveNavigationTarget("back", currentIdentifier, ticket.chatbotMessageIdentifier);
        if (navResult) {
          const { targetNode, newLastStep } = navResult;
          await ticket.update({ chatbotMessageLastStep: newLastStep });
          if (targetNode.hasSubOptions && targetNode.chatbotOptions && targetNode.chatbotOptions.length > 0) {
            let rows: InteractiveListRow[] = targetNode.chatbotOptions.map(option => {
              const fullText = option.title.trim();
              if (fullText.includes(':')) {
                const [beforeColon, afterColon] = fullText.split(':').map(s => s.trim());
                return { id: option.id.toString(), title: beforeColon.substring(0, 24), description: afterColon ? afterColon.substring(0, 72) : undefined, label: option.label };
              }
              if (fullText.length <= 24) return { id: option.id.toString(), title: fullText, label: option.label };
              return { id: option.id.toString(), title: fullText.substring(0, 24), description: fullText.substring(24, 96), label: option.label };
            });
            rows = await appendNavigationRows(rows, targetNode, newLastStep, ticket.chatbotMessageIdentifier);
            const rowsForMeta = rows.map(({ label, ...row }) => row);
            const resp = await incClient.sendInteractiveList({
              to: contact.number,
              bodyText: `\u200e${targetNode.value}`,
              buttonText: "Ver opciones",
              sections: [{ rows: rowsForMeta }]
            });
            const optionsText = formatInteractiveListOptionsAsText(rows);
            const cancelMsg = await Message.create({
              id: resp.messages[0].id, ticketId: ticket.id, contactId: contact.id,
              body: `\u200e${targetNode.value}${optionsText}`, fromMe: true, mediaType: "chat",
              read: true, quotedMsgId: null, timestamp: Math.floor(Date.now() / 1000), ack: 3,
              identifier: targetNode.identifier
            });
            await ticket.update({ lastMessage: cancelMsg.body });
            emitEvent({
              to: [ticket.id.toString(), ticket.status],
              event: { name: "appMessage", data: { action: "create", message: cancelMsg, ticket, contact } }
            });
          }
        }
        return;
      }

      if (selectedOptionId === INCIDENCIA_CONFIRM_ID || selectedOptionId === INCIDENCIA_RETRY_ID) {
        // Guard: no procesar si ya está en processing
        if (ticket.incidenciaStatus === "processing") {
          console.log(`[ProcessChatbotResponseMeta] Ya hay una incidencia en procesamiento, ignorando`);
          return;
        }

        console.log(`[ProcessChatbotResponseMeta] Confirmación/reintento de incidencia para ticket ${ticket.id}`);

        // Enviar mensaje de "procesando"
        const processingBody = "⏳ Registrando tu solicitud, por favor espera...";
        const processingResp = await incClient.sendText({ to: contact.number, body: processingBody });
        const processingMsg = await Message.create({
          id: processingResp.messages[0].id, ticketId: ticket.id, contactId: contact.id,
          body: processingBody, fromMe: true, mediaType: "chat",
          read: true, quotedMsgId: null, timestamp: Math.floor(Date.now() / 1000), ack: 3
        });
        await ticket.update({ lastMessage: processingMsg.body });
        emitEvent({
          to: [ticket.id.toString(), ticket.status],
          event: { name: "appMessage", data: { action: "create", message: processingMsg, ticket, contact } }
        });

        // Ejecutar creación de incidencia
        const result = await CreateIncidenciaService({ ticket, contact, whatsapp });

        if (result.success) {
          // Enviar confirmación con número de incidencia
          const successBody = `✅ Tu solicitud fue registrada correctamente con el número *${result.incidenciaId}*.\nNuestro equipo técnico ya recibió el caso y está asignando un especialista.\n\n📞 Te contactaremos directamente a este número lo antes posible.\n🙏 Por favor espera unos minutos mientras gestionamos tu atención.`;
          const successRows: InteractiveListRow[] = [
            { id: INCIDENCIA_RESOLVED_ID, title: "Problema solucionado", label: INCIDENCIA_RESOLVED_ID }
          ];
          const successRowsForMeta = successRows.map(({ label, ...row }) => row);
          const successResp = await incClient.sendInteractiveList({
            to: contact.number,
            bodyText: successBody,
            buttonText: "Ver opciones",
            sections: [{ rows: successRowsForMeta }]
          });
          const successOptText = formatInteractiveListOptionsAsText(successRows);
          const successMsg = await Message.create({
            id: successResp.messages[0].id, ticketId: ticket.id, contactId: contact.id,
            body: `${successBody}${successOptText}`, fromMe: true, mediaType: "chat",
            read: true, quotedMsgId: null, timestamp: Math.floor(Date.now() / 1000), ack: 3
          });
          await ticket.update({ lastMessage: successMsg.body });
          emitEvent({
            to: [ticket.id.toString(), ticket.status],
            event: { name: "appMessage", data: { action: "create", message: successMsg, ticket, contact } }
          });

          // Mantener chatbot activo para que pueda usar "Menú principal" o "Nueva solicitud"
          // No limpiar chatbotMessageIdentifier
          console.log(`[ProcessChatbotResponseMeta] Incidencia ${result.incidenciaId} creada exitosamente`);
        } else {
          // Error: ofrecer reintentar o menú principal
          const errorBody = `❌ No fue posible registrar tu solicitud en este momento.\n\n${result.error || ""}`;
          const errorRows: InteractiveListRow[] = [
            { id: INCIDENCIA_RETRY_ID, title: "🔄 Reintentar", label: INCIDENCIA_RETRY_ID },
            { id: NAV_HOME_ID, title: "🏠 Menú principal", label: NAV_HOME_ID }
          ];
          const errorRowsForMeta = errorRows.map(({ label, ...row }) => row);
          const errorResp = await incClient.sendInteractiveList({
            to: contact.number,
            bodyText: errorBody,
            buttonText: "Ver opciones",
            sections: [{ rows: errorRowsForMeta }]
          });
          const errorOptText = formatInteractiveListOptionsAsText(errorRows);
          const errorMsg = await Message.create({
            id: errorResp.messages[0].id, ticketId: ticket.id, contactId: contact.id,
            body: `${errorBody}${errorOptText}`, fromMe: true, mediaType: "chat",
            read: true, quotedMsgId: null, timestamp: Math.floor(Date.now() / 1000), ack: 3
          });
          await ticket.update({ lastMessage: errorMsg.body });
          emitEvent({
            to: [ticket.id.toString(), ticket.status],
            event: { name: "appMessage", data: { action: "create", message: errorMsg, ticket, contact } }
          });

          console.log(`[ProcessChatbotResponseMeta] Error creando incidencia: ${result.error}`);
        }
        return;
      }
    }
    // ── Fin interceptar flujo de incidencia ──

    // ── Interceptar awaiting_confirmation con mensaje inesperado (texto libre) ──
    if (ticket.incidenciaStatus === "awaiting_confirmation") {
      console.log(`[ProcessChatbotResponseMeta] Mensaje inesperado durante awaiting_confirmation para ticket ${ticket.id}, re-enviando opciones de confirmación`);
      const awaitClient = new MetaApiClient({
        phoneNumberId: whatsapp.phoneNumberId,
        accessToken: whatsapp.metaAccessToken
      });
      const awaitBody = "Por favor, selecciona una de las opciones para continuar:";
      const awaitRows: InteractiveListRow[] = [
        { id: INCIDENCIA_CONFIRM_ID, title: "✅ Confirmar registro", label: INCIDENCIA_CONFIRM_ID },
        { id: INCIDENCIA_CANCEL_ID, title: "❌ Cancelar y volver", label: INCIDENCIA_CANCEL_ID },
        { id: NAV_HOME_ID, title: "🏠 Menú principal", label: NAV_HOME_ID }
      ];
      const awaitRowsForMeta = awaitRows.map(({ label, ...row }) => row);
      const awaitResp = await awaitClient.sendInteractiveList({
        to: contact.number,
        bodyText: awaitBody,
        buttonText: "Ver opciones",
        sections: [{ rows: awaitRowsForMeta }]
      });
      const awaitOptText = formatInteractiveListOptionsAsText(awaitRows);
      const awaitMsg = await Message.create({
        id: awaitResp.messages[0].id, ticketId: ticket.id, contactId: contact.id,
        body: `${awaitBody}${awaitOptText}`, fromMe: true, mediaType: "chat",
        read: true, quotedMsgId: null, timestamp: Math.floor(Date.now() / 1000), ack: 3
      });
      await ticket.update({ lastMessage: awaitMsg.body });
      emitEvent({
        to: [ticket.id.toString(), ticket.status],
        event: { name: "appMessage", data: { action: "create", message: awaitMsg, ticket, contact } }
      });
      return;
    }
    // ── Fin interceptar awaiting_confirmation ──

    // ── Interceptar error con mensaje inesperado (texto libre) ──
    if (ticket.incidenciaStatus === "error") {
      console.log(`[ProcessChatbotResponseMeta] Mensaje inesperado durante error para ticket ${ticket.id}, re-enviando opciones de reintento`);
      const errClient = new MetaApiClient({
        phoneNumberId: whatsapp.phoneNumberId,
        accessToken: whatsapp.metaAccessToken
      });
      const errBody = "Tu solicitud no pudo registrarse. Por favor selecciona una opción:";
      const errRows: InteractiveListRow[] = [
        { id: INCIDENCIA_RETRY_ID, title: "🔄 Reintentar", label: INCIDENCIA_RETRY_ID },
        { id: NAV_HOME_ID, title: "🏠 Menú principal", label: NAV_HOME_ID }
      ];
      const errRowsForMeta = errRows.map(({ label, ...row }) => row);
      const errResp = await errClient.sendInteractiveList({
        to: contact.number,
        bodyText: errBody,
        buttonText: "Ver opciones",
        sections: [{ rows: errRowsForMeta }]
      });
      const errOptText = formatInteractiveListOptionsAsText(errRows);
      const errMsg = await Message.create({
        id: errResp.messages[0].id, ticketId: ticket.id, contactId: contact.id,
        body: `${errBody}${errOptText}`, fromMe: true, mediaType: "chat",
        read: true, quotedMsgId: null, timestamp: Math.floor(Date.now() / 1000), ack: 3
      });
      await ticket.update({ lastMessage: errMsg.body });
      emitEvent({
        to: [ticket.id.toString(), ticket.status],
        event: { name: "appMessage", data: { action: "create", message: errMsg, ticket, contact } }
      });
      return;
    }
    // ── Fin interceptar error ──

    if (!chatbotMessageReplied.chatbotOptions || chatbotMessageReplied.chatbotOptions.length === 0) {
      console.log("[ProcessChatbotResponseMeta] No hay opciones disponibles, finalizando chatbot");
      await ticket.update({
        chatbotMessageIdentifier: null,
        chatbotMessageLastStep: null,
        chatbotFinishedAt: new Date()
      });
      return;
    }

    // Buscar la opción elegida por el usuario
    let chooseOption;

    if (selectedOptionId) {
      // Si viene de un mensaje interactivo, buscar por ID exacto
      console.log(`[ProcessChatbotResponseMeta] Buscando opción por ID: ${selectedOptionId}`);
      chooseOption = chatbotMessageReplied.chatbotOptions.find(co =>
        co.id.toString() === selectedOptionId
      );
    } else {
      // Si es mensaje de texto (legacy), normalizar y buscar
      const normalizedUserMessage = userMessage.trim().toUpperCase();

      // Primero intentar coincidencia exacta, luego includes
      chooseOption = chatbotMessageReplied.chatbotOptions.find(co =>
        normalizedUserMessage === co.label.toUpperCase()
      );

      // Si no hay coincidencia exacta, buscar si el mensaje incluye la letra
      if (!chooseOption) {
        chooseOption = chatbotMessageReplied.chatbotOptions.find(co =>
          normalizedUserMessage.includes(co.label.toUpperCase())
        );
      }
    }

    if (!chooseOption) {
      console.log(`[ProcessChatbotResponseMeta] No se encontró opción para la respuesta: "${userMessage}"`);

      // Enviar mensaje de error con lista interactiva
      const client = new MetaApiClient({
        phoneNumberId: whatsapp.phoneNumberId,
        accessToken: whatsapp.metaAccessToken
      });

      const errorBodyText = `❌ Lo siento, no entendí tu respuesta.\n\nPor favor, selecciona una de las siguientes opciones:`;

      let rows: InteractiveListRow[] = chatbotMessageReplied.chatbotOptions.map(option => {
        const fullText = option.title.trim();

        // Detectar si hay dos puntos para separar título y descripción
        if (fullText.includes(':')) {
          const [beforeColon, afterColon] = fullText.split(':').map(s => s.trim());

          return {
            id: option.id.toString(),
            title: beforeColon.substring(0, 24),
            description: afterColon ? afterColon.substring(0, 72) : undefined,
            label: option.label
          };
        }

        // Si no hay dos puntos y el texto es corto, solo título
        if (fullText.length <= 24) {
          return {
            id: option.id.toString(),
            title: fullText,
            label: option.label
          };
        }

        // Si es largo sin dos puntos, cortar en 24 y poner el resto en descripción
        return {
          id: option.id.toString(),
          title: fullText.substring(0, 24),
          description: fullText.substring(24, 96),
          label: option.label
        };
      });

      // Agregar opciones de navegación si estamos en un submenú
      rows = await appendNavigationRows(
        rows,
        chatbotMessageReplied,
        ticket.chatbotMessageLastStep,
        ticket.chatbotMessageIdentifier
      );

      // Crear rows sin el campo label para enviar a Meta API
      const rowsForMeta = rows.map(({ label, ...row }) => row);

      const errorResponse = await client.sendInteractiveList({
        to: contact.number,
        bodyText: errorBodyText,
        buttonText: "Ver opciones",
        sections: [
          {
            rows: rowsForMeta
          }
        ]
      });

      const errorMessageId = errorResponse.messages[0].id;

      // Guardar mensaje de error en BD
      const errorOptionsText = formatInteractiveListOptionsAsText(rows);
      const errorMessage = await Message.create({
        id: errorMessageId,
        ticketId: ticket.id,
        contactId: contact.id,
        body: `${errorBodyText}${errorOptionsText}`,
        fromMe: true,
        mediaType: "chat",
        read: true,
        quotedMsgId: null,
        timestamp: Math.floor(Date.now() / 1000),
        ack: 3,
        identifier: chatbotMessageReplied.identifier
      });
      await ticket.update({ lastMessage: errorMessage.body });

      // Emitir evento socket para mostrar mensaje en frontend
      emitEvent({
        to: [ticket.id.toString(), ticket.status],
        event: {
          name: "appMessage",
          data: {
            action: "create",
            message: errorMessage,
            ticket: ticket,
            contact: contact
          }
        }
      });

      console.log(`[ProcessChatbotResponseMeta] Mensaje de error con lista interactiva enviado, esperando respuesta válida`);
      return;
    }

    console.log(`[ProcessChatbotResponseMeta] Opción seleccionada: ${chooseOption.label} - ${chooseOption.title}`);

    // Si es la primera opción seleccionada (estamos en el mensaje raíz), guardar la categoría
    if (ticket.chatbotMessageIdentifier === chatbotMessageReplied.identifier && !ticket.chatbotSelectedCategory) {
      // Extraer solo la parte corta del título (antes de ":" o máximo 30 caracteres)
      let categoryText = chooseOption.title.trim();
      if (categoryText.includes(':')) {
        categoryText = categoryText.split(':')[0].trim();
      }
      if (categoryText.length > 30) {
        categoryText = categoryText.substring(0, 30) + '...';
      }

      await ticket.update({
        chatbotSelectedCategory: categoryText
      });
      console.log(`[ProcessChatbotResponseMeta] Categoría guardada: ${categoryText}`);

      // ── Activar flujo de incidencia si la opción seleccionada tiene el flag activo ──
      if (chooseOption.flujoConIncidencia) {
        const initialPath = buildIncidenciaPath(null, { id: chooseOption.id, title: chooseOption.title });
        await ticket.update({
          incidenciaFlowActive: true,
          incidenciaStatus: "idle",
          incidenciaPathJson: initialPath,
          incidenciaExternalId: null,
          incidenciaLastAttemptAt: null
        });
        console.log(`[ProcessChatbotResponseMeta] Flujo de incidencia activado para opción: ${chooseOption.title}`);
      }
    } else if (ticket.incidenciaFlowActive) {
      // ── Tracking de ruta: agregar opción seleccionada al path ──
      const updatedPath = buildIncidenciaPath(ticket.incidenciaPathJson, { id: chooseOption.id, title: chooseOption.title });
      await ticket.update({ incidenciaPathJson: updatedPath });
      console.log(`[ProcessChatbotResponseMeta] Incidencia path actualizado: ${updatedPath}`);
    }

    // Cargar el siguiente mensaje del chatbot (replica wbotMessageListener.ts:956-969)
    const nextChatbotMessage = await ChatbotMessage.findOne({
      where: {
        id: chooseOption.id
      },
      include: [
        {
          model: ChatbotMessage,
          as: "chatbotOptions",
          where: { wasDeleted: false },
          required: false,
          separate: true,
          order: [["order", "ASC"]]
        }
      ]
    });

    if (!nextChatbotMessage) {
      console.error(`[ProcessChatbotResponseMeta] No se encontró el siguiente mensaje del chatbot con id: ${chooseOption.id}`);
      return;
    }

    console.log(`[ProcessChatbotResponseMeta] Siguiente mensaje: ${nextChatbotMessage.identifier}, hasSubOptions: ${nextChatbotMessage.hasSubOptions}`);

    // Crear cliente Meta API
    const client = new MetaApiClient({
      phoneNumberId: whatsapp.phoneNumberId,
      accessToken: whatsapp.metaAccessToken
    });

    // Enviar mensaje
    let messageId: string;
    let message: string;

    if (nextChatbotMessage.hasSubOptions && nextChatbotMessage.chatbotOptions && nextChatbotMessage.chatbotOptions.length > 0) {
      console.log(`[ProcessChatbotResponseMeta] Enviando lista interactiva con ${nextChatbotMessage.chatbotOptions.length} opciones`);

      let rows: InteractiveListRow[] = nextChatbotMessage.chatbotOptions.map(option => {
        const fullText = option.title.trim();

        // Detectar si hay dos puntos para separar título y descripción
        if (fullText.includes(':')) {
          const [beforeColon, afterColon] = fullText.split(':').map(s => s.trim());

          return {
            id: option.id.toString(),
            title: beforeColon.substring(0, 24),
            description: afterColon ? afterColon.substring(0, 72) : undefined,
            label: option.label
          };
        }

        // Si no hay dos puntos y el texto es corto, solo título
        if (fullText.length <= 24) {
          return {
            id: option.id.toString(),
            title: fullText,
            label: option.label
          };
        }

        // Si es largo sin dos puntos, cortar en 24 y poner el resto en descripción
        return {
          id: option.id.toString(),
          title: fullText.substring(0, 24),
          description: fullText.substring(24, 96),
          label: option.label
        };
      });

      // Agregar opciones de navegación si el siguiente nodo es un submenú
      rows = await appendNavigationRows(
        rows,
        nextChatbotMessage,
        nextChatbotMessage.identifier,
        ticket.chatbotMessageIdentifier
      );

      // Crear rows sin el campo label para enviar a Meta API
      const rowsForMeta = rows.map(({ label, ...row }) => row);

      const response = await client.sendInteractiveList({
        to: contact.number,
        bodyText: `\u200e${nextChatbotMessage.value}`,
        buttonText: "Ver opciones",
        sections: [
          {
            rows: rowsForMeta
          }
        ]
      });

      messageId = response.messages[0].id;
      const optionsText = formatInteractiveListOptionsAsText(rows);
      message = `\u200e${nextChatbotMessage.value}${optionsText}`;
    } else if (nextChatbotMessage.mediaType === "image" && nextChatbotMessage.mediaUrl) {
      console.log(`[ProcessChatbotResponseMeta] Enviando imagen con caption`);

      message = `\u200e${nextChatbotMessage.value}`;

      const uploadResult = await client.uploadMedia(
        nextChatbotMessage.mediaUrl,
        "image/jpeg"
      );

      const response = await client.sendImage({
        to: contact.number,
        mediaId: uploadResult.id,
        caption: message
      });

      messageId = response.messages[0].id;
    } else {
      console.log(`[ProcessChatbotResponseMeta] Enviando mensaje de texto`);

      message = `\u200e${nextChatbotMessage.value}`;

      const response = await client.sendText({
        to: contact.number,
        body: message
      });

      messageId = response.messages[0].id;
    }

    console.log(`[ProcessChatbotResponseMeta] Mensaje enviado con ID: ${messageId}`);

    // Guardar mensaje en BD
    const botMessage = await Message.create({
      id: messageId,
      ticketId: ticket.id,
      contactId: contact.id,
      body: message,
      fromMe: true,
      mediaType: nextChatbotMessage.mediaType || "chat",
      mediaUrl: nextChatbotMessage.mediaUrl || null,
      read: true,
      quotedMsgId: null,
      timestamp: Math.floor(Date.now() / 1000),
      ack: 3,
      identifier: nextChatbotMessage.identifier
    });
    await ticket.update({ lastMessage: botMessage.body });

    // Emitir evento socket para mostrar mensaje en frontend
    emitEvent({
      to: [ticket.id.toString(), ticket.status],
      event: {
        name: "appMessage",
        data: {
          action: "create",
          message: botMessage,
          ticket: ticket,
          contact: contact
        }
      }
    });

    // Actualizar ticket (replica wbotMessageListener.ts:1046-1048)
    // Si el mensaje NO tiene más opciones, el bot terminó
    if (isRealLeafNode(nextChatbotMessage)) {
      if (ticket.incidenciaFlowActive) {
        // ── Nodo hoja con flujo de incidencia: mostrar confirmación ──
        console.log(`[ProcessChatbotResponseMeta] Nodo hoja con incidencia activa, mostrando confirmación`);

        await ticket.update({
          chatbotMessageLastStep: nextChatbotMessage.identifier,
          incidenciaStatus: "awaiting_confirmation"
        });

        // Enviar lista interactiva de confirmación
        const confirmBody = "¿Deseas registrar esta solicitud como incidencia?";
        const confirmRows: InteractiveListRow[] = [
          { id: INCIDENCIA_CONFIRM_ID, title: "✅ Confirmar registro", label: INCIDENCIA_CONFIRM_ID },
          { id: INCIDENCIA_CANCEL_ID, title: "❌ Cancelar y volver", label: INCIDENCIA_CANCEL_ID },
          { id: NAV_HOME_ID, title: "🏠 Menú principal", label: NAV_HOME_ID }
        ];
        const confirmRowsForMeta = confirmRows.map(({ label, ...row }) => row);
        const confirmResp = await client.sendInteractiveList({
          to: contact.number,
          bodyText: confirmBody,
          buttonText: "Ver opciones",
          sections: [{ rows: confirmRowsForMeta }]
        });
        const confirmOptText = formatInteractiveListOptionsAsText(confirmRows);
        const confirmMsg = await Message.create({
          id: confirmResp.messages[0].id,
          ticketId: ticket.id,
          contactId: contact.id,
          body: `${confirmBody}${confirmOptText}`,
          fromMe: true,
          mediaType: "chat",
          read: true,
          quotedMsgId: null,
          timestamp: Math.floor(Date.now() / 1000),
          ack: 3
        });
        await ticket.update({ lastMessage: confirmMsg.body });
        emitEvent({
          to: [ticket.id.toString(), ticket.status],
          event: { name: "appMessage", data: { action: "create", message: confirmMsg, ticket, contact } }
        });
      } else {
        // ── Nodo hoja sin incidencia: comportamiento original ──
        console.log(`[ProcessChatbotResponseMeta] Bot terminó (sin más opciones), limpiando chatbot y guardando chatbotFinishedAt`);
        await ticket.update({
          chatbotMessageIdentifier: null,
          chatbotMessageLastStep: null,
          chatbotFinishedAt: new Date()
        });
      }
    } else {
      // Si tiene más opciones, actualizar el último paso
      await ticket.update({
        chatbotMessageLastStep: nextChatbotMessage.identifier
      });
    }

    console.log(`[ProcessChatbotResponseMeta] Respuesta del chatbot enviada exitosamente para ticket ${ticket.id}`);

  } catch (error) {
    console.error(`[ProcessChatbotResponseMeta] Error procesando respuesta del chatbot:`, error);
    Sentry.captureException(error);
    throw error;
  }
};

export default ProcessChatbotResponseMeta;
