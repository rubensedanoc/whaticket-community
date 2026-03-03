/**
 * Tipos para operaciones de grupos - Meta WhatsApp Cloud API
 * Documentación: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/groups
 */

import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";

// ========== PARAMS ==========

export interface CreateGroupParams {
  whatsappId: number;
  subject: string;
  description?: string;
  joinApprovalMode?: 'auto_approve' | 'approval_required';
}

export interface GroupInviteLinkParams {
  whatsappId: number;
  groupId: string;
}

export interface GroupInfoParams {
  whatsappId: number;
  groupId: string;
}

export interface JoinRequestParams {
  whatsappId: number;
  groupId: string;
}

export interface ManageJoinRequestsParams {
  whatsappId: number;
  groupId: string;
  joinRequestIds: string[];
}

export interface RemoveParticipantsParams {
  whatsappId: number;
  groupId: string;
  participants: string[];
}

export interface UpdateGroupSettingsParams {
  whatsappId: number;
  groupId: string;
  subject?: string;
  description?: string;
}

export interface DeleteGroupParams {
  whatsappId: number;
  groupId: string;
}

export interface GetActiveGroupsParams {
  whatsappId: number;
  limit?: number;
  after?: string;
  before?: string;
}

// ========== RESULTS ==========

export interface CreateGroupResult {
  groupId: string;
  subject: string;
  description?: string;
  joinApprovalMode: string;
  contact: Contact;
  ticket: Ticket;
}

export interface GroupInviteLinkResult {
  groupId: string;
  inviteLink: string;
}

export interface GroupInfoResult {
  id: string;
  subject: string;
  description?: string;
  suspended: boolean;
  creationTimestamp: number;
  totalParticipantCount: number;
  participants: Array<{ wa_id: string }>;
  joinApprovalMode: string;
}

export interface JoinRequestResult {
  joinRequestId: string;
  waId: string;
  creationTimestamp: number;
}

export interface ManageJoinRequestsResult {
  success: boolean;
  approved?: string[];
  rejected?: string[];
  failed: any[];
}

export interface DeleteGroupResult {
  success: boolean;
}
