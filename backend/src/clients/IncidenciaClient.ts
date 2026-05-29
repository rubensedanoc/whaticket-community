import axios, { AxiosInstance } from "axios";

interface IncidenciaClientConfig {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  testMode?: boolean;
}

interface CreateIncidentRequest {
  incidenciacliente_descripcion: string;
  incidenciacliente_contactotelefono: string;
  incidenciacliente_contactoreferencia: string;
  tipoproblema_id: string;
  [key: string]: any;
}

interface CreateIncidentParams {
  payload: CreateIncidentRequest;
  suscripcion?: string;
  localId?: string;
  dominio?: string;
}

interface CreateIncidentResponse {
  mensajes: Array<{ mensaje: string }>;
  tipo: number;
  data?: string; // incidenciaId cuando tipo === 1
}

export class BusinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessError";
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

export class ApiError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = "ApiError";
  }
}

export class IncidenciaClient {
  private client: AxiosInstance;
  private testMode: boolean;

  constructor(config: IncidenciaClientConfig = {}) {
    const baseUrl = config.baseUrl || process.env.BILLING_INCIDENCIA_BASE_URL;
    const apiKey = config.apiKey || process.env.BILLING_INCIDENCIA_API_KEY;
    const timeoutMs = config.timeoutMs || parseInt(process.env.BILLING_INCIDENCIA_TIMEOUT_MS || "15000");
    this.testMode = config.testMode ?? (process.env.BILLING_INCIDENCIA_TEST_MODE === "true");

    if (!baseUrl) {
      throw new Error("BILLING_INCIDENCIA_BASE_URL is required");
    }

    // En modo test, la API KEY no es obligatoria
    if (!this.testMode && !apiKey) {
      throw new Error("BILLING_INCIDENCIA_API_KEY is required");
    }

    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        "Content-Type": "application/json"
      },
      timeout: timeoutMs
    });
  }

  async createIncident(params: CreateIncidentParams): Promise<string> {
    const { payload, suscripcion = "demoperu", localId = "1", dominio = "restaurant.pe" } = params;

    if (this.testMode) return this.simulateCreateIncident(payload);

    try {
      const url = `/incidenciaclientev2/${suscripcion}/${localId}/${dominio}`;
      const response = await this.client.post<CreateIncidentResponse>(
        url,
        payload
      );

      const { tipo, data, mensajes } = response.data;

      if (tipo === 1 && data) {
        return data; // incidenciaId
      } else {
        const errorMessage = mensajes?.[0]?.mensaje || "Error desconocido del servicio de incidencias";
        throw new BusinessError(errorMessage);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
          throw new TimeoutError("Timeout al conectar con el servicio de incidencias");
        }

        if (error.response) {
          throw new ApiError(
            `Error del servicio de incidencias: ${error.response.statusText}`,
            error.response.status
          );
        }

        if (error.request) {
          throw new ApiError("No se recibió respuesta del servicio de incidencias");
        }
      }

      throw new ApiError(`Error inesperado: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private simulateCreateIncident(payload: CreateIncidentRequest): Promise<string> {
    return new Promise((resolve, reject) => {
      // Simular latencia de 1-2 segundos
      const delay = Math.random() * 1000 + 1000;

      setTimeout(() => {
        // 90% éxito, 10% error
        if (Math.random() < 0.99) {
          const mockId = `TEST-INC-${Date.now()}`;
          resolve(mockId);
        } else {
          reject(new BusinessError("Error simulado en modo test"));
        }
      }, delay);
    });
  }
}
