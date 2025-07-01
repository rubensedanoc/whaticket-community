import { Request, Response } from "express";
import AppError from "../errors/AppError";
import AnalizeTicketToCreateAConversationIAEvaluationService from "../services/ConversationIAEvalutaion/AnalizeTicketToCreateAConversationIAEvaluationService";
import AddColumnToResultOfConversationIAEvaluationsService from "../services/ConversationIAEvalutaion/AddColumnToResultOfConversationIAEvaluationsService";

export const analize = async (req: Request, res: Response): Promise<Response> => {
  const {
    ticketId
  } = req.body;

  if (!ticketId) {
    throw new AppError("Ticket ID is required", 400);
  }

  const response = await AnalizeTicketToCreateAConversationIAEvaluationService({
    ticketId
  })

  return res.status(200).json(response);
}

export const addColumnToResults = async (req: Request, res: Response): Promise<Response> => {
  const {
    columnName,
    columnValue,
    columnWhereToAdd
  } = req.body;

  if (!columnName || !columnValue || !columnWhereToAdd) {
    throw new AppError("All fields are required: columnName, columnValue, columnWhereToAdd", 400);
  }

  const response = await AddColumnToResultOfConversationIAEvaluationsService({
    columnName,
    columnValue,
    columnWhereToAdd
  });

  return res.status(200).json(response);
}
