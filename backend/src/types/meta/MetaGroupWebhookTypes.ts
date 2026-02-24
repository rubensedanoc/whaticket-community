/**
 * Tipos para Webhooks de Grupos - Meta WhatsApp Cloud API
 * Basado en: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components#groups
 */

// ============================================
// PAYLOAD PRINCIPAL
// ============================================

export interface MetaGroupWebhookPayload {
  object: "whatsapp_business_account";
  entry: MetaGroupWebhookEntry[];
}

export interface MetaGroupWebhookEntry {
  id: string; // WhatsApp Business Account ID
  changes: MetaGroupWebhookChange[];
}

export interface MetaGroupWebhookChange {
  value: MetaGroupWebhookValue;
  field: MetaGroupWebhookField;
}

export type MetaGroupWebhookField = 
  | "group_lifecycle_update"
  | "group_participants_update"
  | "group_settings_update"
  | "group_status_update";

export interface MetaGroupWebhookValue {
  messaging_product: "whatsapp";
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  groups: MetaGroupEvent[];
}

// ============================================
// EVENTOS DE CICLO DE VIDA (group_lifecycle_update)
// ============================================

export type MetaGroupLifecycleType = "group_create" | "group_delete";

export interface MetaGroupLifecycleEvent {
  timestamp: string;
  group_id: string;
  type: MetaGroupLifecycleType;
  request_id?: string;
  
  // Para group_create exitoso
  subject?: string;
  description?: string;
  invite_link?: string;
  join_approval_mode?: "on" | "off";
  
  // Para errores
  errors?: MetaGroupError[];
}

// ============================================
// EVENTOS DE PARTICIPANTES (group_participants_update)
// ============================================

export type MetaGroupParticipantsType = 
  | "group_participants_add"
  | "group_participants_remove"
  | "group_join_request_created"
  | "group_join_request_revoked";

export interface MetaGroupParticipantsEvent {
  timestamp: string;
  group_id: string;
  type: MetaGroupParticipantsType;
  request_id?: string;
  reason?: "invite_link" | string;
  
  // Para participantes agregados
  added_participants?: MetaGroupParticipant[];
  
  // Para participantes removidos
  removed_participants?: MetaGroupParticipant[];
  failed_participants?: MetaGroupFailedParticipant[];
  
  // Para solicitudes de unión
  join_request_id?: string;
  wa_id?: string;
  
  // Quién inició la acción
  initiated_by?: "business" | "participant";
  
  // Errores
  errors?: MetaGroupError[];
}

export interface MetaGroupParticipant {
  input?: string; // Número de teléfono
  wa_id?: string; // WhatsApp ID
}

export interface MetaGroupFailedParticipant extends MetaGroupParticipant {
  errors: MetaGroupError[];
}

// ============================================
// EVENTOS DE CONFIGURACIÓN (group_settings_update)
// ============================================

export interface MetaGroupSettingsEvent {
  timestamp: string;
  group_id: string;
  type: "group_settings_update";
  request_id?: string;
  
  profile_picture?: MetaGroupProfilePictureUpdate;
  group_subject?: MetaGroupSubjectUpdate;
  group_description?: MetaGroupDescriptionUpdate;
  
  errors?: MetaGroupError[];
}

export interface MetaGroupProfilePictureUpdate {
  mime_type: string;
  sha256: string;
  update_successful: boolean;
  errors?: MetaGroupError[];
}

export interface MetaGroupSubjectUpdate {
  text: string;
  update_successful: boolean;
  errors?: MetaGroupError[];
}

export interface MetaGroupDescriptionUpdate {
  text: string;
  update_successful: boolean;
  errors?: MetaGroupError[];
}

// ============================================
// EVENTOS DE ESTADO (group_status_update)
// ============================================

export type MetaGroupStatusType = "group_suspended" | "group_unsuspended";

export interface MetaGroupStatusEvent {
  timestamp: string;
  group_id: string;
  type: MetaGroupStatusType;
  reason?: string;
}

// ============================================
// TIPOS COMUNES
// ============================================

export interface MetaGroupError {
  code: number;
  message: string;
  title: string;
  error_data?: {
    details: string;
  };
}

// Union type de todos los eventos de grupo
export type MetaGroupEvent = 
  | MetaGroupLifecycleEvent
  | MetaGroupParticipantsEvent
  | MetaGroupSettingsEvent
  | MetaGroupStatusEvent;

// ============================================
// TYPE GUARDS
// ============================================

export const isGroupLifecycleEvent = (event: MetaGroupEvent): event is MetaGroupLifecycleEvent => {
  return event.type === "group_create" || event.type === "group_delete";
};

export const isGroupParticipantsEvent = (event: MetaGroupEvent): event is MetaGroupParticipantsEvent => {
  return event.type === "group_participants_add" || 
         event.type === "group_participants_remove" ||
         event.type === "group_join_request_created" ||
         event.type === "group_join_request_revoked";
};

export const isGroupSettingsEvent = (event: MetaGroupEvent): event is MetaGroupSettingsEvent => {
  return event.type === "group_settings_update";
};

export const isGroupStatusEvent = (event: MetaGroupEvent): event is MetaGroupStatusEvent => {
  return event.type === "group_suspended" || event.type === "group_unsuspended";
};
