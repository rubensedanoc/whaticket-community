import { Request, Response } from "express";
import SendApiChatbotMessage from "../services/WbotServices/SendApiChatbotMessage";
import SendExternalWhatsAppImageMessage from "../services/WbotServices/SendExternalWhatsAppImageMessage";
import SendExternalWhatsAppMessage from "../services/WbotServices/SendExternalWhatsAppMessage";

export const sendApiChatbotMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  console.log("--- CALL FOR sendApiChatbotMessage", req.body);

  const {
    botNumber,
    toNumbers,
    messageVariables,
    chatbotMessageIdentifier,
    localbi_id
  } = req.body;

  const result = await SendApiChatbotMessage({
    botNumber,
    toNumbers,
    messageVariables,
    chatbotMessageIdentifier,
    localbi_id
  });

  if (!result.ok) {
    return res.status(400).json(result);
  }

  return res.status(200).json(result);
};

export const sendMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { fromNumber, toNumber, message } = req.body;

  const sendExternalWhatsAppMessage = await SendExternalWhatsAppMessage({
    fromNumber,
    toNumber,
    message,
    createRegisterInDb: true
  });

  return res.status(200).json(sendExternalWhatsAppMessage);
};

export const sendImageMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { fromNumber, toNumber, imageUrl, caption } = req.body;

  const newMessage = await SendExternalWhatsAppImageMessage({
    fromNumber,
    toNumber,
    imageUrl,
    caption
  });

  return res.status(200).json(newMessage);
};
