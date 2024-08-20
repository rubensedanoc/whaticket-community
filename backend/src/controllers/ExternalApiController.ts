import { Request, Response } from "express";
import SendExternalWhatsAppMessage from "../services/WbotServices/SendExternalWhatsAppMessage";

export const sendMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { fromNumber, toNumber, message } = req.body;

  await SendExternalWhatsAppMessage({ fromNumber, toNumber, message });

  return res.send(200).send();
};
