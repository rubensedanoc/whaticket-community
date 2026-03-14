import { Request, Response } from "express";
import ListGroupsWithAltaService from "../services/GroupServices/ListGroupsWithAltaService";
import LeaveGroupService from "../services/GroupServices/LeaveGroupService";

export const listGroupsWithAlta = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId, clientelicenciaEtapaId } = req.query;

  const { groups, count } = await ListGroupsWithAltaService({
    whatsappId: whatsappId ? Number(whatsappId) : undefined,
    clientelicenciaEtapaId: clientelicenciaEtapaId ? Number(clientelicenciaEtapaId) : 5 // Default: 5 (ALTA)
  });

  return res.status(200).json({ groups, count });
};

export const leaveGroup = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { addNote, userId } = req.body;

  // Si no se proporciona userId, usar 1 (sistema) como default
  const finalUserId = userId ? Number(userId) : 1;

  const result = await LeaveGroupService({
    ticketId: Number(ticketId),
    userId: finalUserId,
    addNote: addNote || false
  });

  return res.status(200).json(result);
};
