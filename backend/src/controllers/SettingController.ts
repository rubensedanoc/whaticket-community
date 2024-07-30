import { Request, Response } from "express";

import AppError from "../errors/AppError";

import { emitEvent } from "../libs/emitEvent";
import ListSettingsService from "../services/SettingServices/ListSettingsService";
import UpdateSettingService from "../services/SettingServices/UpdateSettingService";

export const index = async (req: Request, res: Response): Promise<Response> => {
  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const settings = await ListSettingsService();

  return res.status(200).json(settings);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  const { settingKey: key } = req.params;
  const { value } = req.body;

  const setting = await UpdateSettingService({
    key,
    value
  });

  emitEvent({
    event: {
      name: "settings",
      data: {
        action: "update",
        setting
      }
    }
  });

  // const io = getIO();
  // io.emit("settings", {
  //   action: "update",
  //   setting
  // });

  return res.status(200).json(setting);
};
