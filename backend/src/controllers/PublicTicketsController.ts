import { Request, Response } from "express";
import AppError from "../errors/AppError";
import ListPublicTicketsService, {
  ListPublicTicketsParams
} from "../services/TicketServices/ListPublicTicketsService";

/**
 * Token opcional para la API pública de tickets.
 * Si la variable de entorno PUBLIC_TICKETS_API_TOKEN no está definida,
 * el endpoint queda completamente público (comportamiento por defecto).
 */
const assertAuthorized = (req: Request): void => {
  const expectedToken = process.env.PUBLIC_TICKETS_API_TOKEN;

  if (!expectedToken) return;

  const headerToken =
    (req.headers["x-api-token"] as string) ||
    (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const queryToken = (req.query.token as string) || "";

  if (headerToken !== expectedToken && queryToken !== expectedToken) {
    throw new AppError("Token de acceso inválido o ausente", 401);
  }
};

export const index = async (
  req: Request,
  res: Response
): Promise<Response> => {
  assertAuthorized(req);

  const params = req.query as unknown as ListPublicTicketsParams;

  const result = await ListPublicTicketsService(params);

  return res.status(200).json(result);
};

export const show = async (
  req: Request,
  res: Response
): Promise<Response> => {
  assertAuthorized(req);

  const { ticketId } = req.params;

  const result = await ListPublicTicketsService({
    ...(req.query as unknown as ListPublicTicketsParams),
    ticketId,
    // Un ticket puntual puede consultarse sin importar su año de creación
    startDate: "2000-01-01",
    endDate: "2100-12-31",
    year: undefined,
    page: 1,
    pageSize: 1
  });

  if (!result.data.length) {
    throw new AppError("Ticket no encontrado", 404);
  }

  return res.status(200).json({
    success: true,
    data: result.data[0]
  });
};
