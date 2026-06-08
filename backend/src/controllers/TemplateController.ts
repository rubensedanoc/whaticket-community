import { Request, Response } from "express";
import AppError from "../errors/AppError";
import ResolveTemplateService from "../services/TemplateServices/ResolveTemplateService";

export const resolve = async (req: Request, res: Response): Promise<Response> => {
  const { name, language } = req.body;

  if (!name || !language) {
    throw new AppError("name and language are required", 400);
  }

  const template = await ResolveTemplateService({ name, language });
  return res.status(200).json(template);
};
