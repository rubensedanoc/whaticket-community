import Contact from "../../models/Contact";
import IncidenciaLog from "../../models/IncidenciaLog";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { IncidenciaClient, BusinessError, TimeoutError, ApiError } from "../../clients/IncidenciaClient";
import { MetaApiClient } from "../../clients/MetaApiClient";
import * as Sentry from "@sentry/node";
import CheckDuplicateIncidenciaService from "./CheckDuplicateIncidenciaService";

// Valores por defecto cuando no se puede extraer el dominio
export const DEFAULT_DOMINIO = "restaurant.pe";
export const DEFAULT_SUBDOMAIN = "demoperu";

const COUNTRY_ID_MAPPER: Record<number, number> = {
  // Mapeo -> [ID_WhatMeta]: ID_Billing
  3: 5,   // Brazil
  4: 8,   // Chile
  5: 9,   // Colombia
  6: 3,   // Costa Rica
  8: 12,  // Dominican Republic
  9: 10,  // Ecuador
  10: 11, // El Salvador
  11: 13, // Guatemala
  14: 2,  // Mexico
  15: 4,  // Nicaragua
  18: 1   // Peru
};

const formatIncidenciaDescripcion = (pathJson: string | null, externalSupportData: string | null): string => {
  let descripcion = "";

  // Agregar datos externos de soporte si existen
  if (externalSupportData) {
    try {
      const supportData = JSON.parse(externalSupportData);
      const parts: string[] = [];

      if (supportData.local) parts.push(`Local: ${supportData.local}`);
      if (supportData.caja) parts.push(`Caja: ${supportData.caja}`);
      if (supportData.usuario) parts.push(`Usuario: ${supportData.usuario}`);

      if (parts.length > 0) {
        descripcion = parts.join(" | ") + "\n\n";
      }
    } catch (error) {
      console.error("[CreateIncidenciaService] Error parsing externalSupportData:", error);
    }
  }

  // Agregar path del chatbot
  if (pathJson) {
    try {
      const path = JSON.parse(pathJson);
      const pathTitles = path.map((node: any) => node.title).join(" > ");
      descripcion += pathTitles;
    } catch (error) {
      console.error("[CreateIncidenciaService] Error parsing pathJson for description:", error);
    }
  }

  return descripcion;
};

interface CreateIncidenciaParams {
  ticket: Ticket;
  contact: Contact;
  whatsapp: Whatsapp;
}

const CreateIncidenciaService = async (params: CreateIncidenciaParams): Promise<{ success: boolean; incidenciaId?: string; error?: string }> => {
  const { ticket, contact, whatsapp } = params;

  try {
    console.log(`[CreateIncidenciaService] Creando incidencia para ticket ${ticket.id}`);

    // Validar que exista pathJson
    if (!ticket.incidenciaPathJson) throw new Error("No hay pathJson para crear incidencia");

    // Guard anti-duplicidad (10 segundos)
    const now = new Date();
    const lastAttempt = ticket.incidenciaLastAttemptAt ? new Date(ticket.incidenciaLastAttemptAt) : null;
    if (lastAttempt && (now.getTime() - lastAttempt.getTime()) < 10000) {
      console.log(`[CreateIncidenciaService] Anti-duplicidad activado, último intento hace menos de 10s`);
      return { success: false, error: "Ya se está procesando tu solicitud, por favor espera." };
    }

    // Actualizar lastAttemptAt
    await ticket.update({ incidenciaLastAttemptAt: now });

    // Validar duplicados por dominio en intervalo de 15 minutos
    if (contact.domain && ticket.incidenciaPathJson) {
      const duplicateCheck = await CheckDuplicateIncidenciaService({
        domain: contact.domain,
        pathJson: ticket.incidenciaPathJson,
        intervalMinutes: 15
      });

      if (duplicateCheck.isDuplicate) {
        console.log(`[CreateIncidenciaService] Incidencia duplicada detectada para dominio ${contact.domain}`);
        return {
          success: false,
          error: "DUPLICATE_INCIDENCIA",
          incidenciaId: duplicateCheck.existingTicket?.incidenciaExternalId
        };
      }
    }

    // Enviar mensaje de "Procesando..."
    const client = new MetaApiClient({ phoneNumberId: whatsapp.phoneNumberId, accessToken: whatsapp.metaAccessToken });
    await client.sendText({ to: contact.number, body: "⏳ Registrando tu solicitud, por favor espera..." });

    const billingCountryId = COUNTRY_ID_MAPPER[contact.countryId] || 1;
    const localId = "1";
    const descripcion = formatIncidenciaDescripcion(ticket.incidenciaPathJson, ticket.externalSupportData);

    // Formato esperado: https://restaurantefestin.restaurant.pe
    let suscripcion = DEFAULT_SUBDOMAIN;
    let dominio = DEFAULT_DOMINIO;

    if (contact.domain) {
      try {
        // Add protocol if missing
        const domainWithProtocol = contact.domain.startsWith('http')
          ? contact.domain
          : `https://${contact.domain}`;
        const url = new URL(domainWithProtocol);
        const hostname = url.hostname;
        const parts = hostname.split(".");
        if (parts.length >= 2) {
          dominio = parts.slice(-2).join(".");
          suscripcion = parts.slice(0, -2).join(".");
        }
      } catch (error) {
        console.error("[CreateIncidenciaService] Error parsing domain:", error);
      }
    }

    const fechaHora = now.toISOString().replace("T", " ").substring(0, 19);
    const ticketUrl = `https://whaticketmeta-app.restaurant.pe:8890/tickets/${ticket.id}`;

    const payload = {
      incidenciacliente_clienteregistro: "CHATBOTMETA",
      incidenciacliente_descripcion: descripcion,
      incidenciacliente_local: localId,
      incidenciacliente_contactoreferencia: ticketUrl,
      incidenciacliente_contactotelefono: contact.number,
      incidenciacliente_usuarioid: "1",
      incidenciacliente_direccionremota:  "",
      incidenciacliente_plataforma: "WEB",
      incidenciacliente_paisid: String(billingCountryId),
      incidenciacliente_fechahoraregistro: fechaHora,
      tipoproblema_id: "6",
      incidenciacliente_llamarapersonal: 0
    };

    // Llamar a Billing API
    const billingClient = new IncidenciaClient();
    const incidenciaId = await billingClient.createIncident({ payload, suscripcion, localId, dominio });

    // Guardar en IncidenciaLog
    await IncidenciaLog.create({
      ticketId: ticket.id,
      requestPayload: JSON.stringify(payload),
      responsePayload: JSON.stringify({ incidenciaId }),
      status: "success",
      errorMessage: null
    });

    // Actualizar Ticket con el ID de incidencia
    await ticket.update({ incidenciaExternalId: incidenciaId });

    console.log(`[CreateIncidenciaService] Incidencia creada exitosamente: ${incidenciaId}`);

    return { success: true, incidenciaId };

  } catch (error) {
    console.error(`[CreateIncidenciaService] Error creando incidencia:`, error);

    let errorMessage = "No fue posible registrar tu solicitud en este momento.";

    // Guardar error en IncidenciaLog
    await IncidenciaLog.create({
      ticketId: ticket.id,
      requestPayload: JSON.stringify({}),
      responsePayload: null,
      status: "error",
      errorMessage: error instanceof Error ? error.message : String(error)
    });

    if (error instanceof BusinessError) {
      errorMessage = error.message;
    } else if (error instanceof TimeoutError) {
      errorMessage = "El servicio de incidencias está tardando en responder";
    } else if (error instanceof ApiError) {
      errorMessage = "Error de comunicación con el servicio de incidencias";
    }

    // Reportar a Sentry
    Sentry.captureException(error);

    return { success: false, error: errorMessage };
  }
};

export default CreateIncidenciaService;
