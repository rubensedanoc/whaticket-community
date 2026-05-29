import { Request, Response } from "express";
import {
  CreateMetaGroup,
  GetGroupInviteLink,
  ResetGroupInviteLink,
  GetGroupInfo,
  GetJoinRequests,
  ApproveJoinRequests,
  RejectJoinRequests,
  RemoveGroupParticipants,
  UpdateGroupSettings,
  DeleteMetaGroup,
  GetActiveGroups
} from "../services/MetaServices/MetaGroupService";

/**
 * Controller para operaciones REST de grupos Meta
 * Basado en la documentación oficial de WhatsApp Cloud API
 * Endpoints para testing manual desde Postman
 */

/**
 * POST /meta-groups
 * Crear un nuevo grupo
 * El invite link se recibirá automáticamente via webhook
 */
export const createGroup = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { whatsappId, subject, description, joinApprovalMode } = req.body;

    if (!whatsappId || !subject) {
      return res.status(400).json({
        error: "whatsappId y subject son requeridos"
      });
    }

    const result = await CreateMetaGroup({
      whatsappId: parseInt(whatsappId),
      subject,
      description,
      joinApprovalMode: joinApprovalMode || 'auto_approve'
    });

    return res.status(201).json({
      success: true,
      message: "Grupo creado. El invite link llegará via webhook.",
      data: {
        groupId: result.groupId,
        subject: result.subject,
        description: result.description,
        joinApprovalMode: result.joinApprovalMode,
        contact: {
          id: result.contact.id,
          name: result.contact.name,
          number: result.contact.number,
          isGroup: result.contact.isGroup
        },
        ticket: {
          id: result.ticket.id,
          status: result.ticket.status,
          isGroup: result.ticket.isGroup
        }
      }
    });
  } catch (error: any) {
    console.error("[MetaGroupController] Error creando grupo:", error);
    return res.status(500).json({
      error: error.message || "Error al crear grupo"
    });
  }
};

/**
 * GET /meta-groups/:groupId/invite-link
 * Obtener invite link de un grupo
 */
export const getInviteLink = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { groupId } = req.params;
    const { whatsappId } = req.query;

    if (!whatsappId) {
      return res.status(400).json({
        error: "whatsappId es requerido como query param"
      });
    }

    const result = await GetGroupInviteLink({
      whatsappId: parseInt(whatsappId as string),
      groupId
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error("[MetaGroupController] Error obteniendo invite link:", error);
    return res.status(500).json({
      error: error.message || "Error al obtener invite link"
    });
  }
};

/**
 * POST /meta-groups/:groupId/invite-link/reset
 * Restablecer invite link (revoca el anterior y genera uno nuevo)
 */
export const resetInviteLink = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { groupId } = req.params;
    const { whatsappId } = req.body;

    if (!whatsappId) {
      return res.status(400).json({
        error: "whatsappId es requerido"
      });
    }

    const result = await ResetGroupInviteLink({
      whatsappId: parseInt(whatsappId),
      groupId
    });

    return res.status(200).json({
      success: true,
      message: "Invite link restablecido. El anterior ya no es válido.",
      data: result
    });
  } catch (error: any) {
    console.error("[MetaGroupController] Error restableciendo invite link:", error);
    return res.status(500).json({
      error: error.message || "Error al restablecer invite link"
    });
  }
};

/**
 * GET /meta-groups/:groupId
 * Obtener información completa del grupo (incluye participantes)
 */
export const getGroupInfo = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { groupId } = req.params;
    const { whatsappId } = req.query;

    if (!whatsappId) {
      return res.status(400).json({
        error: "whatsappId es requerido como query param"
      });
    }

    const result = await GetGroupInfo({
      whatsappId: parseInt(whatsappId as string),
      groupId
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error("[MetaGroupController] Error obteniendo info del grupo:", error);
    return res.status(500).json({
      error: error.message || "Error al obtener información del grupo"
    });
  }
};

/**
 * GET /meta-groups/:groupId/join-requests
 * Obtener solicitudes de unión pendientes
 */
export const getJoinRequests = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { groupId } = req.params;
    const { whatsappId } = req.query;

    if (!whatsappId) {
      return res.status(400).json({
        error: "whatsappId es requerido como query param"
      });
    }

    const result = await GetJoinRequests({
      whatsappId: parseInt(whatsappId as string),
      groupId
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error("[MetaGroupController] Error obteniendo solicitudes:", error);
    return res.status(500).json({
      error: error.message || "Error al obtener solicitudes de unión"
    });
  }
};

/**
 * POST /meta-groups/:groupId/join-requests/approve
 * Aprobar solicitudes de unión
 */
export const approveJoinRequests = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { groupId } = req.params;
    const { whatsappId, joinRequestIds } = req.body;

    if (!whatsappId || !joinRequestIds || !Array.isArray(joinRequestIds)) {
      return res.status(400).json({
        error: "whatsappId y joinRequestIds (array) son requeridos"
      });
    }

    const result = await ApproveJoinRequests({
      whatsappId: parseInt(whatsappId),
      groupId,
      joinRequestIds
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error("[MetaGroupController] Error aprobando solicitudes:", error);
    return res.status(500).json({
      error: error.message || "Error al aprobar solicitudes"
    });
  }
};

/**
 * POST /meta-groups/:groupId/join-requests/reject
 * Rechazar solicitudes de unión
 */
export const rejectJoinRequests = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { groupId } = req.params;
    const { whatsappId, joinRequestIds } = req.body;

    if (!whatsappId || !joinRequestIds || !Array.isArray(joinRequestIds)) {
      return res.status(400).json({
        error: "whatsappId y joinRequestIds (array) son requeridos"
      });
    }

    const result = await RejectJoinRequests({
      whatsappId: parseInt(whatsappId),
      groupId,
      joinRequestIds
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error("[MetaGroupController] Error rechazando solicitudes:", error);
    return res.status(500).json({
      error: error.message || "Error al rechazar solicitudes"
    });
  }
};

/**
 * DELETE /meta-groups/:groupId/participants
 * Eliminar participantes del grupo
 * NOTA: Los participantes eliminados NO podrán volver a unirse via invite link
 */
export const removeParticipants = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { groupId } = req.params;
    const { whatsappId, participants } = req.body;

    if (!whatsappId || !participants || !Array.isArray(participants)) {
      return res.status(400).json({
        error: "whatsappId y participants (array) son requeridos"
      });
    }

    const result = await RemoveGroupParticipants({
      whatsappId: parseInt(whatsappId),
      groupId,
      participants
    });

    return res.status(200).json({
      success: true,
      message: "Participantes eliminados. NO podrán volver a unirse via invite link.",
      data: result
    });
  } catch (error: any) {
    console.error("[MetaGroupController] Error eliminando participantes:", error);
    return res.status(500).json({
      error: error.message || "Error al eliminar participantes"
    });
  }
};

/**
 * PUT /meta-groups/:groupId/settings
 * Actualizar configuración del grupo (nombre, descripción)
 */
export const updateGroupSettings = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { groupId } = req.params;
    const { whatsappId, subject, description } = req.body;

    if (!whatsappId) {
      return res.status(400).json({
        error: "whatsappId es requerido"
      });
    }

    if (!subject && !description) {
      return res.status(400).json({
        error: "Debe proporcionar al menos subject o description"
      });
    }

    const result = await UpdateGroupSettings({
      whatsappId: parseInt(whatsappId),
      groupId,
      subject,
      description
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error("[MetaGroupController] Error actualizando configuración:", error);
    return res.status(500).json({
      error: error.message || "Error al actualizar configuración del grupo"
    });
  }
};

/**
 * DELETE /meta-groups/:groupId
 * Eliminar un grupo completamente
 * Elimina el grupo y a todos sus participantes
 */
export const deleteGroup = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { groupId } = req.params;
    const { whatsappId } = req.body;

    if (!whatsappId) {
      return res.status(400).json({
        error: "whatsappId es requerido"
      });
    }

    const result = await DeleteMetaGroup({
      whatsappId: parseInt(whatsappId),
      groupId
    });

    return res.status(200).json({
      success: true,
      message: "Grupo eliminado completamente",
      data: result
    });
  } catch (error: any) {
    console.error("[MetaGroupController] Error eliminando grupo:", error);
    return res.status(500).json({
      error: error.message || "Error al eliminar grupo"
    });
  }
};

/**
 * GET /meta-groups
 * Obtener lista de grupos activos
 */
export const getActiveGroups = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { whatsappId, limit, after, before } = req.query;

    if (!whatsappId) {
      return res.status(400).json({
        error: "whatsappId es requerido como query param"
      });
    }

    const result = await GetActiveGroups({
      whatsappId: parseInt(whatsappId as string),
      limit: limit ? parseInt(limit as string) : 25,
      after: after as string,
      before: before as string
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error("[MetaGroupController] Error obteniendo grupos activos:", error);
    return res.status(500).json({
      error: error.message || "Error al obtener grupos activos"
    });
  }
};
