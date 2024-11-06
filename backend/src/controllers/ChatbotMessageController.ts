import { Request, Response } from "express";
import { emitEvent } from "../libs/emitEvent";
import CreateChatbotMessageService from "../services/ChatbotMessageService/CreateChatbotMessageService";
import DeleteChatbotMessageService from "../services/ChatbotMessageService/DeleteChatbotMessageService";
import ListChatbotMessageService from "../services/ChatbotMessageService/ListChatbotMessageService";
import ShowChatbotMessageService from "../services/ChatbotMessageService/ShowChatbotMessageService";
import UpdateChatbotMessageService from "../services/ChatbotMessageService/UpdateChatbotMessageService";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { onlyFathers } = req.query;

  const chatbotOptions = await ListChatbotMessageService({
    onlyFathers: +onlyFathers
  });

  return res.status(200).json(chatbotOptions);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const {
    identifier,
    title,
    value,
    fatherChatbotMessageId,
    mediaType,
    isActive,
    mediaUrl,
    label,
    order
  } = req.body;

  const chatbotMessage = await CreateChatbotMessageService({
    identifier,
    title,
    value,
    fatherChatbotMessageId,
    mediaType,
    isActive,
    mediaUrl,
    label,
    order
  });

  emitEvent({
    event: {
      name: "chatbotMessage",
      data: {
        action: "update",
        chatbotMessage
      }
    }
  });

  return res.status(200).json(chatbotMessage);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { chatbotMessageId } = req.params;

  const chatbotMessage = await ShowChatbotMessageService(chatbotMessageId);

  return res.status(200).json(chatbotMessage);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { chatbotMessageId } = req.params;

  const chatbotMessage = await UpdateChatbotMessageService({
    chatbotMessageId,
    chatbotMessageData: req.body
  });

  emitEvent({
    event: {
      name: "chatbotMessage",
      data: {
        action: "update",
        chatbotMessage
      }
    }
  });

  return res.status(201).json(chatbotMessage);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { chatbotMessageId } = req.params;

  await DeleteChatbotMessageService(chatbotMessageId);

  emitEvent({
    event: {
      name: "chatbotMessage",
      data: {
        action: "delete",
        chatbotMessageId: +chatbotMessageId
      }
    }
  });

  return res.status(200).send();
};
