import { Request, Response } from "express";
import AppError from "../errors/AppError";
import Whatsapp from "../models/Whatsapp";
import ResolveTemplateService from "../services/TemplateServices/ResolveTemplateService";

export const resolve = async (req: Request, res: Response): Promise<Response> => {
  const { name, language, whatsappId } = req.body;

  if (!name || !language) {
    throw new AppError("name and language are required", 400);
  }

  if (!whatsappId) {
    throw new AppError("whatsappId is required", 400);
  }

  const whatsapp = await Whatsapp.findByPk(whatsappId);
  if (!whatsapp) {
    throw new AppError("Whatsapp no encontrado", 404);
  }

  if (!whatsapp.metaBusinessAccountId) {
    throw new AppError("Este número no tiene WABA ID configurado", 400);
  }

  const template = await ResolveTemplateService({
    name,
    language,
    wabaId: whatsapp.metaBusinessAccountId
  });
  return res.status(200).json(template);
};
