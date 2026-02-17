import axios, { AxiosInstance, AxiosError } from "axios";
import {
  MetaSendMessagePayload,
  SendTextParams,
  SendImageParams,
  SendAudioParams,
  SendDocumentParams,
  buildTextPayload,
  buildImagePayload,
  buildAudioPayload,
  buildDocumentPayload
} from "../types/meta/MetaSendTypes";
import {
  MetaApiSuccessResponse,
  MetaApiErrorResponse,
  MetaApiError,
  isMetaApiError,
  getErrorMessage
} from "../types/meta/MetaApiTypes";

interface MetaApiClientConfig {
  phoneNumberId: string;
  accessToken: string;
  apiVersion?: string;
  baseUrl?: string;
}

export class MetaApiClient {
  private client: AxiosInstance;
  private phoneNumberId: string;

  constructor(config: MetaApiClientConfig) {
    this.phoneNumberId = config.phoneNumberId;
    const apiVersion = config.apiVersion || process.env.META_API_VERSION || "v18.0";
    const baseUrl = config.baseUrl || process.env.META_API_BASE_URL || "https://graph.facebook.com";

    this.client = axios.create({
      baseURL: `${baseUrl}/${apiVersion}`,
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json"
      }
    });
  }

  private async sendMessage(payload: MetaSendMessagePayload): Promise<MetaApiSuccessResponse> {
    try {
      const response = await this.client.post<MetaApiSuccessResponse>(
        `/${this.phoneNumberId}/messages`,
        payload
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<MetaApiErrorResponse>;
        if (axiosError.response?.data && isMetaApiError(axiosError.response.data)) {
          const metaError = axiosError.response.data.error;
          throw new MetaApiException(metaError);
        }
      }
      throw error;
    }
  }

  async sendText(params: SendTextParams): Promise<MetaApiSuccessResponse> {
    const payload = buildTextPayload(params);
    return this.sendMessage(payload);
  }

  async sendImage(params: SendImageParams): Promise<MetaApiSuccessResponse> {
    if (!params.mediaId && !params.mediaUrl) {
      throw new Error("Se requiere mediaId o mediaUrl para enviar imagen");
    }
    const payload = buildImagePayload(params);
    return this.sendMessage(payload);
  }

  async sendAudio(params: SendAudioParams): Promise<MetaApiSuccessResponse> {
    if (!params.mediaId && !params.mediaUrl) {
      throw new Error("Se requiere mediaId o mediaUrl para enviar audio");
    }
    const payload = buildAudioPayload(params);
    return this.sendMessage(payload);
  }

  async sendDocument(params: SendDocumentParams): Promise<MetaApiSuccessResponse> {
    if (!params.mediaId && !params.mediaUrl) {
      throw new Error("Se requiere mediaId o mediaUrl para enviar documento");
    }
    const payload = buildDocumentPayload(params);
    return this.sendMessage(payload);
  }
}

// Excepción personalizada para errores de Meta API
export class MetaApiException extends Error {
  code: number;
  type: string;
  subcode?: number;
  fbtrace_id?: string;

  constructor(error: MetaApiError) {
    super(getErrorMessage(error));
    this.name = "MetaApiException";
    this.code = error.code;
    this.type = error.type;
    this.subcode = error.error_subcode;
    this.fbtrace_id = error.fbtrace_id;
  }
}
