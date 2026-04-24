import Contact from "../../models/Contact";
import IncidenciaLog from "../../models/IncidenciaLog";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { IncidenciaClient, BusinessError, TimeoutError, ApiError } from "../../clients/IncidenciaClient";
import { MetaApiClient } from "../../clients/MetaApiClient";
import * as Sentry from "@sentry/node";

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

const formatIncidenciaDescripcion = (pathJson: string | null): string => {
  if (!pathJson) return "";
  try {
    const path = JSON.parse(pathJson);
    return path.map((node: any) => node.title).join(" > ");
  } catch (error) {
    console.error("[CreateIncidenciaService] Error parsing pathJson for description:", error);
    return "";
  }
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

    // Enviar mensaje de "Procesando..."
    const client = new MetaApiClient({ phoneNumberId: whatsapp.phoneNumberId, accessToken: whatsapp.metaAccessToken });
    await client.sendText({ to: contact.number, body: "⏳ Registrando tu solicitud, por favor espera..." });

    const billingCountryId = COUNTRY_ID_MAPPER[contact.countryId] || 1;
    const localId = "1";
    const descripcion = formatIncidenciaDescripcion(ticket.incidenciaPathJson);

    // Formato esperado: https://restaurantefestin.restaurant.pe
    let suscripcion = "demoperu";
    let dominio = "restaurant.pe";

    if (contact.domain) {
      try {
        const url = new URL(contact.domain);
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
