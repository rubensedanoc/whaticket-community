import axios, { AxiosInstance, AxiosError } from "axios";
import {
  MetaSendMessagePayload,
  SendTextParams,
  SendImageParams,
  SendAudioParams,
  SendDocumentParams,
  SendTemplateParams,
  buildTextPayload,
  buildImagePayload,
  buildAudioPayload,
  buildDocumentPayload,
  buildTemplatePayload
} from "../types/meta/MetaSendTypes";
import {
  MetaApiSuccessResponse,
  MetaApiErrorResponse,
  MetaApiError,
  MetaMediaUploadResponse,
  MetaMediaUrlResponse,
  isMetaApiError,
  getErrorMessage
} from "../types/meta/MetaApiTypes";
import * as fs from "fs";
import * as path from "path";
import FormData from "form-data";

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
      this.handleError(error);
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

  async sendTemplate(params: SendTemplateParams): Promise<MetaApiSuccessResponse> {
    const payload = buildTemplatePayload(params);
    return this.sendMessage(payload);
  }

  // ========== MEDIA ==========

  async uploadMedia(filePath: string, mimeType: string): Promise<MetaMediaUploadResponse> {
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("file", fs.createReadStream(filePath), {
      filename: path.basename(filePath),
      contentType: mimeType
    });
    form.append("type", mimeType);

    try {
      const response = await this.client.post<MetaMediaUploadResponse>(
        `/${this.phoneNumberId}/media`,
        form,
        { headers: form.getHeaders() }
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async getMediaUrl(mediaId: string): Promise<MetaMediaUrlResponse> {
    try {
      const response = await this.client.get<MetaMediaUrlResponse>(`/${mediaId}`);
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async downloadMedia(mediaUrl: string): Promise<Buffer> {
    try {
      const response = await axios.get(mediaUrl, {
        headers: { Authorization: this.client.defaults.headers.Authorization },
        responseType: "arraybuffer"
      });
      return Buffer.from(response.data);
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async deleteMedia(mediaId: string): Promise<{ success: boolean }> {
    try {
      const response = await this.client.delete<{ success: boolean }>(`/${mediaId}`);
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  // ========== GROUPS ==========

  /**
   * Crear un nuevo grupo
   * POST /<PHONE_NUMBER_ID>/groups
   */
  async createGroup(subject: string, description?: string, joinApprovalMode: 'auto_approve' | 'approval_required' = 'auto_approve'): Promise<any> {
    try {
      const response = await this.client.post(
        `/${this.phoneNumberId}/groups`,
        {
          messaging_product: "whatsapp",
          subject,
          ...(description && { description }),
          join_approval_mode: joinApprovalMode
        }
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Obtener invite link de un grupo
   * GET /<GROUP_ID>/invite_link
   */
  async getGroupInviteLink(groupId: string): Promise<any> {
    try {
      const response = await this.client.get(
        `/${groupId}/invite_link`
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Restablecer invite link (revoca el anterior)
   * POST /<GROUP_ID>/invite_link
   */
  async resetGroupInviteLink(groupId: string): Promise<any> {
    try {
      const response = await this.client.post(
        `/${groupId}/invite_link`,
        {
          messaging_product: "whatsapp"
        }
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Obtener información de un grupo
   * GET /<GROUP_ID>?fields=...
   */
  async getGroupInfo(groupId: string, fields?: string[]): Promise<any> {
    try {
      const fieldsParam = fields ? `?fields=${fields.join(',')}` : '';
      const response = await this.client.get(
        `/${groupId}${fieldsParam}`
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Obtener grupos activos
   * GET /<PHONE_NUMBER_ID>/groups
   */
  async getActiveGroups(limit: number = 25, after?: string, before?: string): Promise<any> {
    try {
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      if (after) params.append('after', after);
      if (before) params.append('before', before);

      const response = await this.client.get(
        `/${this.phoneNumberId}/groups?${params.toString()}`
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Eliminar un grupo
   * DELETE /<GROUP_ID>
   */
  async deleteGroup(groupId: string): Promise<any> {
    try {
      const response = await this.client.delete(`/${groupId}`);
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Eliminar participantes de un grupo
   * DELETE /<GROUP_ID>/participants
   */
  async removeGroupParticipants(groupId: string, participants: string[]): Promise<any> {
    try {
      const response = await this.client.delete(
        `/${groupId}/participants`,
        {
          data: {
            messaging_product: "whatsapp",
            participants: participants.map(user => ({ user }))
          }
        }
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Actualizar configuración del grupo
   * POST /<GROUP_ID>
   */
  async updateGroupSettings(groupId: string, settings: { subject?: string; description?: string }): Promise<any> {
    try {
      const response = await this.client.post(
        `/${groupId}`,
        {
          messaging_product: "whatsapp",
          ...settings
        }
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Obtener solicitudes de unión pendientes
   * GET /<GROUP_ID>/join_requests
   */
  async getJoinRequests(groupId: string): Promise<any> {
    try {
      const response = await this.client.get(
        `/${groupId}/join_requests`
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Aprobar solicitudes de unión
   * POST /<GROUP_ID>/join_requests
   */
  async approveJoinRequests(groupId: string, joinRequestIds: string[]): Promise<any> {
    try {
      const response = await this.client.post(
        `/${groupId}/join_requests`,
        {
          messaging_product: "whatsapp",
          join_requests: joinRequestIds
        }
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Rechazar solicitudes de unión
   * DELETE /<GROUP_ID>/join_requests
   */
  async rejectJoinRequests(groupId: string, joinRequestIds: string[]): Promise<any> {
    try {
      const response = await this.client.delete(
        `/${groupId}/join_requests`,
        {
          data: {
            messaging_product: "whatsapp",
            join_requests: joinRequestIds
          }
        }
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  // ========== MESSAGE STATUS ==========

  async markMessageAsRead(messageId: string): Promise<{ success: boolean }> {
    try {
      const response = await this.client.post<{ success: boolean }>(
        `/${this.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          status: "read",
          message_id: messageId
        }
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  private handleError(error: unknown): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<MetaApiErrorResponse>;
      if (axiosError.response?.data && isMetaApiError(axiosError.response.data)) {
        throw new MetaApiException(axiosError.response.data.error);
      }
    }
    throw error;
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
