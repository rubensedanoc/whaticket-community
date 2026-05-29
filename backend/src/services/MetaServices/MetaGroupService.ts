import Whatsapp from "../../models/Whatsapp";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import { MetaApiClient } from "../../clients/MetaApiClient";
import {
  CreateGroupParams,
  CreateGroupResult,
  GroupInviteLinkParams,
  GroupInviteLinkResult,
  GroupInfoParams,
  GroupInfoResult,
  JoinRequestParams,
  JoinRequestResult,
  ManageJoinRequestsParams,
  ManageJoinRequestsResult,
  RemoveParticipantsParams,
  UpdateGroupSettingsParams,
  DeleteGroupParams,
  DeleteGroupResult,
  GetActiveGroupsParams
} from "../../types/meta/MetaGroupApiTypes";

/**
 * Servicio para operaciones de grupos Meta
 * Basado en la documentación oficial de WhatsApp Cloud API
 */

/**
 * Crear grupo en Meta y sincronizar en BD
 * El invite link se recibe automáticamente via webhook group_lifecycle_update
 */
export const CreateMetaGroup = async (params: CreateGroupParams): Promise<CreateGroupResult> => {
  const { whatsappId, subject, description, joinApprovalMode = 'auto_approve' } = params;
  
  const whatsapp = await Whatsapp.findByPk(whatsappId);

  if (!whatsapp) {
    throw new Error(`WhatsApp con ID ${whatsappId} no encontrado`);
  }

  if (whatsapp.apiType !== "meta-api") {
    throw new Error(`WhatsApp ${whatsapp.name} no es de tipo Meta API`);
  }

  const client = new MetaApiClient({
    phoneNumberId: whatsapp.phoneNumberId,
    accessToken: whatsapp.metaAccessToken
  });

  // Crear grupo en Meta API
  console.log(`[CreateMetaGroup] Creando grupo: ${subject}`);
  const metaResponse = await client.createGroup(subject, description, joinApprovalMode);
  
  // La respuesta contiene el ID del grupo
  // El invite_link llegará via webhook group_lifecycle_update
  const groupId = metaResponse.id || metaResponse.groups?.[0]?.id;

  if (!groupId) {
    throw new Error('No se recibió groupId en la respuesta de Meta API');
  }

  console.log(`[CreateMetaGroup] Grupo creado en Meta: ${groupId}`);

  // Crear contacto en BD
  const contact = await Contact.create({
    name: subject,
    number: groupId,
    isGroup: true,
    email: "",
    extraInfo: description ? [{ name: "description", value: description }] : []
  });

  console.log(`[CreateMetaGroup] Contacto creado: ${contact.id}`);

  // Crear ticket en BD
  const ticket = await Ticket.create({
    contactId: contact.id,
    whatsappId: whatsapp.id,
    status: "closed",
    isGroup: true,
    unreadMessages: 0
  });

  console.log(`[CreateMetaGroup] Ticket creado: ${ticket.id}`);

  return {
    groupId,
    subject,
    description,
    joinApprovalMode,
    contact,
    ticket
  };
};

/**
 * Obtener invite link de un grupo
 * GET /<GROUP_ID>/invite_link
 */
export const GetGroupInviteLink = async (params: GroupInviteLinkParams): Promise<GroupInviteLinkResult> => {
  const { whatsappId, groupId } = params;
  
  const whatsapp = await Whatsapp.findByPk(whatsappId);

  if (!whatsapp) {
    throw new Error(`WhatsApp con ID ${whatsappId} no encontrado`);
  }

  const client = new MetaApiClient({
    phoneNumberId: whatsapp.phoneNumberId,
    accessToken: whatsapp.metaAccessToken
  });

  const response = await client.getGroupInviteLink(groupId);
  const inviteLink = response.invite_link;

  console.log(`[GetGroupInviteLink] Invite link obtenido: ${inviteLink}`);

  return {
    groupId,
    inviteLink
  };
};

/**
 * Restablecer invite link (revoca el anterior y genera uno nuevo)
 * POST /<GROUP_ID>/invite_link
 */
export const ResetGroupInviteLink = async (params: GroupInviteLinkParams): Promise<GroupInviteLinkResult> => {
  const { whatsappId, groupId } = params;
  
  const whatsapp = await Whatsapp.findByPk(whatsappId);

  if (!whatsapp) {
    throw new Error(`WhatsApp con ID ${whatsappId} no encontrado`);
  }

  const client = new MetaApiClient({
    phoneNumberId: whatsapp.phoneNumberId,
    accessToken: whatsapp.metaAccessToken
  });

  // Restablecer invite link (revoca el anterior)
  const response = await client.resetGroupInviteLink(groupId);
  const newInviteLink = response.invite_link;

  console.log(`[ResetGroupInviteLink] Nuevo invite link generado: ${newInviteLink}`);

  return {
    groupId,
    inviteLink: newInviteLink
  };
};

/**
 * Obtener información completa de un grupo
 * GET /<GROUP_ID>?fields=...
 */
export const GetGroupInfo = async (params: GroupInfoParams): Promise<GroupInfoResult> => {
  const { whatsappId, groupId } = params;
  
  const whatsapp = await Whatsapp.findByPk(whatsappId);

  if (!whatsapp) {
    throw new Error(`WhatsApp con ID ${whatsappId} no encontrado`);
  }

  const client = new MetaApiClient({
    phoneNumberId: whatsapp.phoneNumberId,
    accessToken: whatsapp.metaAccessToken
  });

  const fields = [
    'subject',
    'description',
    'participants',
    'join_approval_mode',
    'suspended',
    'creation_timestamp',
    'total_participant_count'
  ];

  const response = await client.getGroupInfo(groupId, fields);

  console.log(`[GetGroupInfo] Grupo: ${response.subject}, Participantes: ${response.total_participant_count}`);

  return {
    id: response.id,
    subject: response.subject,
    description: response.description,
    suspended: response.suspended,
    creationTimestamp: response.creation_timestamp,
    totalParticipantCount: response.total_participant_count,
    participants: response.participants || [],
    joinApprovalMode: response.join_approval_mode
  };
};

/**
 * Obtener solicitudes de unión pendientes
 * GET /<GROUP_ID>/join_requests
 */
export const GetJoinRequests = async (params: JoinRequestParams): Promise<JoinRequestResult[]> => {
  const { whatsappId, groupId } = params;
  
  const whatsapp = await Whatsapp.findByPk(whatsappId);

  if (!whatsapp) {
    throw new Error(`WhatsApp con ID ${whatsappId} no encontrado`);
  }

  const client = new MetaApiClient({
    phoneNumberId: whatsapp.phoneNumberId,
    accessToken: whatsapp.metaAccessToken
  });

  const response = await client.getJoinRequests(groupId);

  const joinRequests = response.data.map((req: any) => ({
    joinRequestId: req.join_request_id,
    waId: req.wa_id,
    creationTimestamp: req.creation_timestamp
  }));

  console.log(`[GetJoinRequests] ${joinRequests.length} solicitudes pendientes`);

  return joinRequests;
};

/**
 * Aprobar solicitudes de unión
 * POST /<GROUP_ID>/join_requests
 */
export const ApproveJoinRequests = async (params: ManageJoinRequestsParams): Promise<ManageJoinRequestsResult> => {
  const { whatsappId, groupId, joinRequestIds } = params;
  
  const whatsapp = await Whatsapp.findByPk(whatsappId);

  if (!whatsapp) {
    throw new Error(`WhatsApp con ID ${whatsappId} no encontrado`);
  }

  const client = new MetaApiClient({
    phoneNumberId: whatsapp.phoneNumberId,
    accessToken: whatsapp.metaAccessToken
  });

  const response = await client.approveJoinRequests(groupId, joinRequestIds);

  console.log(`[ApproveJoinRequests] Aprobadas: ${response.approved_join_requests?.length || 0}`);

  return {
    success: true,
    approved: response.approved_join_requests || [],
    rejected: undefined,
    failed: response.failed_join_requests || []
  };
};

/**
 * Rechazar solicitudes de unión
 * DELETE /<GROUP_ID>/join_requests
 */
export const RejectJoinRequests = async (params: ManageJoinRequestsParams): Promise<ManageJoinRequestsResult> => {
  const { whatsappId, groupId, joinRequestIds } = params;
  
  const whatsapp = await Whatsapp.findByPk(whatsappId);

  if (!whatsapp) {
    throw new Error(`WhatsApp con ID ${whatsappId} no encontrado`);
  }

  const client = new MetaApiClient({
    phoneNumberId: whatsapp.phoneNumberId,
    accessToken: whatsapp.metaAccessToken
  });

  const response = await client.rejectJoinRequests(groupId, joinRequestIds);

  console.log(`[RejectJoinRequests] Rechazadas: ${response.rejected_join_requests?.length || 0}`);

  return {
    success: true,
    approved: undefined,
    rejected: response.rejected_join_requests || [],
    failed: response.failed_join_requests || []
  };
};

/**
 * Eliminar participantes de un grupo
 * DELETE /<GROUP_ID>/participants
 * NOTA: Los participantes eliminados NO podrán volver a unirse via invite link
 */
export const RemoveGroupParticipants = async (params: RemoveParticipantsParams): Promise<{ success: boolean }> => {
  const { whatsappId, groupId, participants } = params;
  
  const whatsapp = await Whatsapp.findByPk(whatsappId);

  if (!whatsapp) {
    throw new Error(`WhatsApp con ID ${whatsappId} no encontrado`);
  }

  const client = new MetaApiClient({
    phoneNumberId: whatsapp.phoneNumberId,
    accessToken: whatsapp.metaAccessToken
  });

  await client.removeGroupParticipants(groupId, participants);

  console.log(`[RemoveGroupParticipants] ${participants.length} participantes eliminados`);

  return { success: true };
};

/**
 * Actualizar configuración del grupo
 * POST /<GROUP_ID>
 */
export const UpdateGroupSettings = async (params: UpdateGroupSettingsParams): Promise<{ success: boolean; contact?: Contact }> => {
  const { whatsappId, groupId, subject, description } = params;
  
  const whatsapp = await Whatsapp.findByPk(whatsappId);

  if (!whatsapp) {
    throw new Error(`WhatsApp con ID ${whatsappId} no encontrado`);
  }

  const client = new MetaApiClient({
    phoneNumberId: whatsapp.phoneNumberId,
    accessToken: whatsapp.metaAccessToken
  });

  // Actualizar en Meta API
  const settings: any = {};
  if (subject) settings.subject = subject;
  if (description) settings.description = description;

  await client.updateGroupSettings(groupId, settings);
  console.log(`[UpdateGroupSettings] Grupo actualizado en Meta`);

  // Actualizar en BD
  const contact = await Contact.findOne({
    where: { number: groupId, isGroup: true }
  });

  if (contact) {
    const updateData: any = {};
    if (subject) updateData.name = subject;
    if (description) {
      updateData.extraInfo = [{ name: "description", value: description }];
    }

    await contact.update(updateData);
    console.log(`[UpdateGroupSettings] Contacto actualizado en BD`);
  }

  return {
    success: true,
    contact: contact || undefined
  };
};

/**
 * Eliminar un grupo
 * DELETE /<GROUP_ID>
 * Elimina el grupo y a todos sus participantes
 */
export const DeleteMetaGroup = async (params: DeleteGroupParams): Promise<DeleteGroupResult> => {
  const { whatsappId, groupId } = params;
  
  const whatsapp = await Whatsapp.findByPk(whatsappId);

  if (!whatsapp) {
    throw new Error(`WhatsApp con ID ${whatsappId} no encontrado`);
  }

  const client = new MetaApiClient({
    phoneNumberId: whatsapp.phoneNumberId,
    accessToken: whatsapp.metaAccessToken
  });

  // Eliminar grupo en Meta API
  await client.deleteGroup(groupId);
  console.log(`[DeleteMetaGroup] Grupo eliminado en Meta: ${groupId}`);

  // Cerrar tickets asociados en BD
  const contact = await Contact.findOne({
    where: { number: groupId, isGroup: true }
  });

  if (contact) {
    await Ticket.update(
      { status: "closed" },
      { where: { contactId: contact.id, isGroup: true } }
    );
    console.log(`[DeleteMetaGroup] Tickets cerrados en BD`);
  }

  return { success: true };
};

/**
 * Obtener lista de grupos activos
 * GET /<PHONE_NUMBER_ID>/groups
 */
export const GetActiveGroups = async (params: GetActiveGroupsParams): Promise<any> => {
  const { whatsappId, limit = 25, after, before } = params;
  
  const whatsapp = await Whatsapp.findByPk(whatsappId);

  if (!whatsapp) {
    throw new Error(`WhatsApp con ID ${whatsappId} no encontrado`);
  }

  const client = new MetaApiClient({
    phoneNumberId: whatsapp.phoneNumberId,
    accessToken: whatsapp.metaAccessToken
  });

  const response = await client.getActiveGroups(limit, after, before);

  console.log(`[GetActiveGroups] ${response.data?.groups?.length || 0} grupos activos`);

  return response;
};
