import { Request, Response } from "express";
import SendExternalWhatsAppImageMessage from "../services/WbotServices/SendExternalWhatsAppImageMessage";
import SendExternalWhatsAppMessage from "../services/WbotServices/SendExternalWhatsAppMessage";

export const sendMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { fromNumber, toNumber, message } = req.body;

  await SendExternalWhatsAppMessage({ fromNumber, toNumber, message });

  return res.send(200).send();
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
