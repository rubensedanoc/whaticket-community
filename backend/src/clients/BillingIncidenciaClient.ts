import axios, { AxiosInstance, AxiosError } from "axios";
import * as Sentry from "@sentry/node";

// ========== Custom Error Classes ==========

export class BillingTimeoutError extends Error {
  constructor(message?: string) {
    super(message || "Timeout al conectar con el sistema de Billing Incidencias");
    this.name = "BillingTimeoutError";
  }
}

export class BillingApiError extends Error {
  status: number;
  responseBody: any;

  constructor(status: number, responseBody: any) {
    super(`Error HTTP ${status} del sistema de Billing Incidencias`);
    this.name = "BillingApiError";
    this.status = status;
    this.responseBody = responseBody;
  }
}

export class BillingInvalidResponseError extends Error {
  responseBody: any;

  constructor(responseBody: any) {
    super("Respuesta inválida del sistema de Billing Incidencias: sin identificador de incidencia");
    this.name = "BillingInvalidResponseError";
    this.responseBody = responseBody;
  }
}

export class BillingBusinessError extends Error {
  responseBody: any;

  constructor(message: string, responseBody: any) {
    super(message);
    this.name = "BillingBusinessError";
    this.responseBody = responseBody;
  }
}

// ========== Interfaces ==========

interface BillingIncidenciaClientConfig {
  baseUrl?: string;
  token?: string;
  timeout?: number;
  endpoint?: string;
}

export interface CreateIncidenciaParams {
  contactNumber: string;
  contactName: string;
  descripcion: string;
  ticketId: number;
  localCliente?: string;
  usuarioId?: string;
  direccionRemota?: string;
  plataforma?: string;
  paisId?: string;
  tipoProblemaId?: string;
  datosImpresion?: string;
}

interface BillingRawResponse {
  mensajes: string[];
  tipo: number;
  data: string | null;
}

interface CreateIncidenciaResponse {
  incidenciaId: string;
}

// ========== Client ==========

export class BillingIncidenciaClient {
  private client: AxiosInstance;
  private isTestMode: boolean;
  private endpoint: string;

  constructor(config?: BillingIncidenciaClientConfig) {
    this.isTestMode = process.env.BILLING_INCIDENCIA_TEST_MODE === "true";

    const baseUrl = config?.baseUrl || process.env.BILLING_INCIDENCIA_BASE_URL;
    const timeout = config?.timeout || parseInt(process.env.BILLING_INCIDENCIA_TIMEOUT_MS || "15000", 10);
    this.endpoint = config?.endpoint || "";

    if (!baseUrl && !this.isTestMode) {
      throw new Error("BILLING_INCIDENCIA_BASE_URL no está configurada");
    }

    this.client = axios.create({
      baseURL: baseUrl || "http://localhost",
      timeout,
      headers: {
        "Content-Type": "application/json"
      }
    });

    // Interceptor de logging para requests
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[BillingIncidenciaClient] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, {
          data: config.data
        });
        return config;
      },
      (error) => {
        console.error("[BillingIncidenciaClient] Error en request:", error.message);
        return Promise.reject(error);
      }
    );

    // Interceptor de logging para responses
    this.client.interceptors.response.use(
      (response) => {
        console.log(`[BillingIncidenciaClient] Response ${response.status}:`, response.data);
        return response;
      },
      (error) => {
        if (error.response) {
          console.error(`[BillingIncidenciaClient] Response error ${error.response.status}:`, error.response.data);
        } else if (error.code === "ECONNABORTED") {
          console.error("[BillingIncidenciaClient] Timeout:", error.message);
        } else {
          console.error("[BillingIncidenciaClient] Error:", error.message);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Construye el payload en el formato exacto que espera el sistema Billing.
   */
  private buildBillingPayload(params: CreateIncidenciaParams): Record<string, any> {
    const now = new Date();
    const fechaHora = now.toISOString().replace("T", " ").substring(0, 19);

    const ticketUrl = `https://whaticketmeta-app.restaurant.pe:8890/tickets/${params.ticketId}`;

    const payload: Record<string, any> = {
      incidenciacliente_clienteregistro: "CLIENTE CHATBOTMETA",
      incidenciacliente_descripcion: params.descripcion,
      incidenciacliente_local: params.localCliente || "Local Cliente",
      incidenciacliente_contactoreferencia: ticketUrl,
      incidenciacliente_contactotelefono: params.contactNumber,
      incidenciacliente_usuarioid: params.usuarioId || "1",
      incidenciacliente_direccionremota: params.direccionRemota || "",
      incidenciacliente_plataforma: params.plataforma || "WEB",
      incidenciacliente_paisid: params.paisId || "1",
      incidenciacliente_fechahoraregistro: fechaHora,
      tipoproblema_id: params.tipoProblemaId || "6",
      incidenciacliente_llamarapersonal: 0
    };

    if (params.datosImpresion) {
      payload.incidenciacliente_datosimpresion = params.datosImpresion;
    }

    return payload;
  }

  /**
   * Simula una respuesta del sistema Billing para entorno de pruebas.
   */
  private async simulateResponse(payload: Record<string, any>): Promise<CreateIncidenciaResponse> {
    console.log("[BillingIncidenciaClient] MODO TEST - Simulando respuesta de Billing");
    console.log("[BillingIncidenciaClient] MODO TEST - Payload:", JSON.stringify(payload, null, 2));

    // Simular latencia de red (1-2s)
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

    // 90% éxito, 10% error para pruebas realistas
    const shouldSucceed = Math.random() > 0.1;

    if (shouldSucceed) {
      const simulatedResponse: BillingRawResponse = {
        mensajes: [
          "Incidencia agrega con éxito. En breve se estarán comunicando con usted nuestros representantes."
        ],
        tipo: 1,
        data: `INC-TEST-${Date.now().toString().slice(-6)}`
      };

      console.log("[BillingIncidenciaClient] MODO TEST - Respuesta exitosa simulada:", simulatedResponse);
      return { incidenciaId: simulatedResponse.data! };
    } else {
      const simulatedResponse: BillingRawResponse = {
        mensajes: [
          "No fue posible registrar la incidencia en este momento."
        ],
        tipo: 0,
        data: null
      };

      console.log("[BillingIncidenciaClient] MODO TEST - Respuesta de error simulada:", simulatedResponse);
      throw new BillingBusinessError(
        simulatedResponse.mensajes[0],
        simulatedResponse
      );
    }
  }

  /**
   * Parsea la respuesta cruda del sistema Billing.
   * Éxito cuando tipo === 1 y data contiene el ID de incidencia.
   */
  private parseBillingResponse(responseData: any, params: CreateIncidenciaParams): CreateIncidenciaResponse {
    const billingResponse = responseData as BillingRawResponse;

    // Verificar estructura básica
    if (billingResponse.tipo === undefined || billingResponse.tipo === null) {
      Sentry.captureMessage("BillingIncidenciaClient: respuesta sin campo 'tipo'", {
        extra: { responseData, params }
      });
      throw new BillingInvalidResponseError(responseData);
    }

    // tipo !== 1 → error de negocio
    if (billingResponse.tipo !== 1) {
      const errorMsg = billingResponse.mensajes?.[0] || "Error desconocido del sistema Billing";
      throw new BillingBusinessError(errorMsg, responseData);
    }

    // tipo === 1 pero sin data → respuesta inválida
    if (!billingResponse.data) {
      Sentry.captureMessage("BillingIncidenciaClient: tipo=1 pero sin data", {
        extra: { responseData, params }
      });
      throw new BillingInvalidResponseError(responseData);
    }

    return { incidenciaId: String(billingResponse.data) };
  }

  async createIncidencia(params: CreateIncidenciaParams): Promise<CreateIncidenciaResponse> {
    const payload = this.buildBillingPayload(params);

    // Modo test: simular respuesta sin llamar al API real
    if (this.isTestMode) {
      return this.simulateResponse(payload);
    }

    try {
      const response = await this.client.post(this.endpoint, payload);
      return this.parseBillingResponse(response.data, params);
    } catch (error) {
      // Re-throw errores de negocio y de respuesta inválida tal cual
      if (error instanceof BillingBusinessError || error instanceof BillingInvalidResponseError) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;

        if (axiosError.code === "ECONNABORTED") {
          throw new BillingTimeoutError();
        }

        if (axiosError.response) {
          throw new BillingApiError(
            axiosError.response.status,
            axiosError.response.data
          );
        }
      }

      throw error;
    }
  }
}
