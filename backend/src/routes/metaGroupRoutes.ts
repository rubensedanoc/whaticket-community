import { Router } from "express";
import * as MetaGroupController from "../controllers/MetaGroupController";

/**
 * Rutas para operaciones de grupos Meta
 * Basado en la documentación oficial de WhatsApp Cloud API
 */

const metaGroupRoutes = Router();

// ========== CICLO DE VIDA DE GRUPOS ==========

// Listar grupos activos
metaGroupRoutes.get("/meta-groups", MetaGroupController.getActiveGroups);

// Crear grupo
metaGroupRoutes.post("/meta-groups", MetaGroupController.createGroup);

// Obtener información del grupo (incluye participantes)
metaGroupRoutes.get("/meta-groups/:groupId", MetaGroupController.getGroupInfo);

// Eliminar grupo
metaGroupRoutes.delete("/meta-groups/:groupId", MetaGroupController.deleteGroup);

// ========== INVITE LINKS ==========

// Obtener invite link
metaGroupRoutes.get("/meta-groups/:groupId/invite-link", MetaGroupController.getInviteLink);

// Restablecer invite link (revoca el anterior)
metaGroupRoutes.post("/meta-groups/:groupId/invite-link/reset", MetaGroupController.resetInviteLink);

// ========== SOLICITUDES DE UNIÓN ==========

// Obtener solicitudes pendientes
metaGroupRoutes.get("/meta-groups/:groupId/join-requests", MetaGroupController.getJoinRequests);

// Aprobar solicitudes
metaGroupRoutes.post("/meta-groups/:groupId/join-requests/approve", MetaGroupController.approveJoinRequests);

// Rechazar solicitudes
metaGroupRoutes.post("/meta-groups/:groupId/join-requests/reject", MetaGroupController.rejectJoinRequests);

// ========== PARTICIPANTES ==========

// Eliminar participantes (NO podrán volver a unirse via invite link)
metaGroupRoutes.delete("/meta-groups/:groupId/participants", MetaGroupController.removeParticipants);

// ========== CONFIGURACIÓN ==========

// Actualizar configuración del grupo
metaGroupRoutes.put("/meta-groups/:groupId/settings", MetaGroupController.updateGroupSettings);

export default metaGroupRoutes;
