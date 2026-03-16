import * as Sentry from "@sentry/node";
import {
  BillingIncidenciaClient,
  BillingTimeoutError,
  BillingApiError,
  BillingInvalidResponseError,
  BillingBusinessError,
  CreateIncidenciaParams as BillingCreateParams
} from "../../clients/BillingIncidenciaClient";
import IncidenciaLog from "../../models/IncidenciaLog";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import {
  formatIncidenciaDescripcion,
  formatIncidenciaDetail
} from "../ChatbotMessageService/IncidenciaFlowHelper";

interface CreateIncidenciaParams {
  ticket: Ticket;
  contact: Contact;
  whatsapp: Whatsapp;
}

interface CreateIncidenciaResult {
  success: boolean;
  incidenciaId?: string;
  error?: string;
}

const ANTI_DUPLICATE_WINDOW_MS = 10000; // 10 segundos

/**
 * Mapeador de IDs de países entre el sistema Chatbot y el sistema Billing.
 *
 * El sistema Chatbot usa la tabla Countries con IDs propios.
 * El sistema Billing usa constantes definidas en PHP con IDs diferentes.
 *
 * Este mapper traduce del ID de Chatbot al ID esperado por Billing.
 * Si el país no existe en el mapeo, retorna 1 (Perú) por defecto.
 */
const COUNTRY_ID_MAPPER: Record<number, number> = {
  // Mapeo: [ID_Chatbot]: ID_Billing
  // Basado en la tabla Countries del sistema actual
  3: 5,   // Brazil (Chatbot) -> PAIS_BRASIL (Billing)
  4: 8,   // Chile (Chatbot) -> PAIS_CHILE (Billing)
  5: 9,   // Colombia (Chatbot) -> PAIS_COLOMBIA (Billing)
  6: 3,   // Costa Rica (Chatbot) -> PAIS_COSTA_RICA (Billing)
  8: 12,  // Dominican Republic (Chatbot) -> PAIS_REPUBLICA_DOMINICANA (Billing)
  9: 10,  // Ecuador (Chatbot) -> PAIS_ECUADOR (Billing)
  10: 11, // El Salvador (Chatbot) -> PAIS_EL_SALVADOR (Billing)
  11: 13, // Guatemala (Chatbot) -> PAIS_GUATEMALA (Billing)
  14: 2,  // Mexico (Chatbot) -> PAIS_MEXICO (Billing)
  15: 4,  // Nicaragua (Chatbot) -> PAIS_NICARAGUA (Billing)
  18: 1   // Peru (Chatbot) -> PAIS_PERU (Billing)
};

const DEFAULT_BILLING_COUNTRY_ID = 1; // Perú por defecto

/**
 * Traduce el countryId del sistema Chatbot al ID equivalente del sistema Billing.
 * @param chatbotCountryId - ID del país en la tabla Countries del sistema Chatbot
 * @returns ID del país esperado por el sistema Billing
 */
const mapCountryIdToBilling = (chatbotCountryId: number | null | undefined): string => {
  if (!chatbotCountryId) {
    console.log(`[mapCountryIdToBilling] No se proporcionó countryId, usando default: ${DEFAULT_BILLING_COUNTRY_ID}`);
    return String(DEFAULT_BILLING_COUNTRY_ID);
  }

  const billingId = COUNTRY_ID_MAPPER[chatbotCountryId];

  if (billingId === undefined) {
    console.warn(`[mapCountryIdToBilling] País con ID ${chatbotCountryId} no encontrado en mapper, usando default: ${DEFAULT_BILLING_COUNTRY_ID}`);
    return String(DEFAULT_BILLING_COUNTRY_ID);
  }

  console.log(`[mapCountryIdToBilling] Mapeando país: Chatbot ID ${chatbotCountryId} -> Billing ID ${billingId}`);
  return String(billingId);
};

interface UrlParams {
  suscripcion: string;
  localId: string;
  dominio: string;
}

/**
 * Extrae el subdominio y dominio base desde una URL completa almacenada en Contact.domain
 * Ejemplo: "https://restaurantefestin.restaurant.pe" -> { suscripcion: "restaurantefestin", dominio: "restaurant.pe" }
 */
const extractUrlParams = (domain: string | null | undefined): UrlParams => {
  const defaults: UrlParams = {
    suscripcion: "demoperu",
    localId: "1",
    dominio: "restaurant.pe"
  };

  if (!domain || domain.trim() === "") {
    return defaults;
  }

  try {
    // Remover protocolo si existe
    let cleanDomain = domain.trim();
    cleanDomain = cleanDomain.replace(/^https?:\/\//, "");
    cleanDomain = cleanDomain.replace(/\/.*$/, ""); // Remover path si existe

    // Dividir por puntos
    const parts = cleanDomain.split(".");

    if (parts.length < 2) {
      // No hay suficientes partes para extraer subdominio y dominio
      return defaults;
    }

    // Extraer subdominio (primera parte)
    const suscripcion = parts[0];

    // Extraer dominio base (todo excepto la primera parte)
    const dominio = parts.slice(1).join(".");

    return {
      suscripcion: suscripcion || defaults.suscripcion,
      localId: "1",
      dominio: dominio || defaults.dominio
    };
  } catch (error) {
    console.error("[extractUrlParams] Error extrayendo parámetros de URL:", error);
    return defaults;
  }
};

/**
 * Construye la URL del endpoint de creación de incidencias
 * Formato: /incidenciaclientev2/:suscripcion/:local_id/:dominio
 */
const buildIncidenciaEndpoint = (urlParams: UrlParams): string => {
  return `/incidenciaclientev2/${urlParams.suscripcion}/${urlParams.localId}/${urlParams.dominio}`;
};

const CreateIncidenciaService = async ({
  ticket,
  contact
}: CreateIncidenciaParams): Promise<CreateIncidenciaResult> => {
  // Guard anti-duplicidad: rechazar si el último intento fue hace menos de 10s
  if (ticket.incidenciaLastAttemptAt) {
    const elapsed = Date.now() - new Date(ticket.incidenciaLastAttemptAt).getTime();
    if (elapsed < ANTI_DUPLICATE_WINDOW_MS) {
      console.log(`[CreateIncidenciaService] Rechazando intento duplicado para ticket ${ticket.id} (${elapsed}ms desde último intento)`);
      return {
        success: false,
        error: "Solicitud duplicada. Por favor espera unos segundos antes de intentar de nuevo."
      };
    }
  }

  // Marcar como procesando
  await ticket.update({
    incidenciaStatus: "processing",
    incidenciaLastAttemptAt: new Date()
  });

  // Construir detalle legible y descripción concatenada para Billing
  const detail = ticket.incidenciaPathJson
    ? formatIncidenciaDetail(ticket.incidenciaPathJson)
    : "Sin detalle disponible";

  const descripcion = ticket.incidenciaPathJson
    ? formatIncidenciaDescripcion(ticket.incidenciaPathJson)
    : "Sin descripción disponible";

  // Mapear el countryId del sistema Chatbot al ID que espera el sistema Billing
  const billingCountryId = mapCountryIdToBilling(contact.countryId);

  // Payload en el formato que espera el sistema Billing
  const requestPayload: BillingCreateParams = {
    contactNumber: contact.number,
    contactName: contact.name,
    descripcion,
    ticketId: ticket.id,
    paisId: billingCountryId
  };

  // Crear log de intento
  const incidenciaLog = await IncidenciaLog.create({
    ticketId: ticket.id,
    contactId: contact.id,
    detail,
    status: "processing",
    requestPayload: JSON.stringify(requestPayload)
  });

  try {
    // Extraer parámetros de URL desde Contact.domain
    const urlParams = extractUrlParams(contact.domain);
    const endpoint = buildIncidenciaEndpoint(urlParams);

    console.log(`[CreateIncidenciaService] URL construida para ticket ${ticket.id}:`, {
      contactDomain: contact.domain,
      urlParams,
      endpoint
    });

    const billingClient = new BillingIncidenciaClient({ endpoint });
    const response = await billingClient.createIncidencia(requestPayload);

    // Éxito
    await ticket.update({
      incidenciaStatus: "completed",
      incidenciaExternalId: response.incidenciaId
    });

    await incidenciaLog.update({
      status: "success",
      externalId: response.incidenciaId,
      responsePayload: JSON.stringify(response)
    });

    console.log(`[CreateIncidenciaService] Incidencia creada exitosamente: ${response.incidenciaId} para ticket ${ticket.id}`);

    return {
      success: true,
      incidenciaId: response.incidenciaId
    };
  } catch (error: any) {
    let errorMessage = "Error desconocido al registrar la incidencia";

    if (error instanceof BillingTimeoutError) {
      errorMessage = "El sistema de incidencias no respondió a tiempo. Intenta de nuevo.";
    } else if (error instanceof BillingApiError) {
      errorMessage = `Error del sistema de incidencias (HTTP ${error.status})`;
    } else if (error instanceof BillingBusinessError) {
      errorMessage = error.message;
    } else if (error instanceof BillingInvalidResponseError) {
      errorMessage = "El sistema de incidencias respondió pero sin un número de incidencia válido";
    } else {
      errorMessage = error.message || errorMessage;
    }

    // Actualizar ticket a estado de error
    await ticket.update({
      incidenciaStatus: "error"
    });

    // Actualizar log con el error
    await incidenciaLog.update({
      status: "error",
      errorMessage: errorMessage,
      responsePayload: (error instanceof BillingApiError || error instanceof BillingBusinessError)
        ? JSON.stringify(error.responseBody)
        : error.message
    });

    // Reportar a Sentry
    Sentry.captureException(error, {
      extra: {
        ticketId: ticket.id,
        contactId: contact.id,
        detail,
        requestPayload
      }
    });

    console.error(`[CreateIncidenciaService] Error creando incidencia para ticket ${ticket.id}:`, errorMessage);

    return {
      success: false,
      error: errorMessage
    };
  }
};

export default CreateIncidenciaService;
