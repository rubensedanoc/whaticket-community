import { Request, Response } from "express";
import * as Yup from "yup";

import CreateQuickAnswerService from "../services/QuickAnswerService/CreateQuickAnswerService";
import DeleteQuickAnswerService from "../services/QuickAnswerService/DeleteQuickAnswerService";
import ListQuickAnswerService from "../services/QuickAnswerService/ListQuickAnswerService";
import ShowQuickAnswerService from "../services/QuickAnswerService/ShowQuickAnswerService";
import UpdateQuickAnswerService from "../services/QuickAnswerService/UpdateQuickAnswerService";

import AppError from "../errors/AppError";
import { emitEvent } from "../libs/emitEvent";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
};

interface QuickAnswerData {
  shortcut: string;
  message: string;
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber } = req.query as IndexQuery;

  const { quickAnswers, count, hasMore } = await ListQuickAnswerService({
    searchParam,
    pageNumber
  });

  return res.json({ quickAnswers, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const newQuickAnswer: QuickAnswerData = req.body;

  const QuickAnswerSchema = Yup.object().shape({
    shortcut: Yup.string().required(),
    message: Yup.string().required()
  });

  try {
    await QuickAnswerSchema.validate(newQuickAnswer);
  } catch (err) {
    throw new AppError(err.message);
  }

  const quickAnswer = await CreateQuickAnswerService({
    ...newQuickAnswer
  });

  emitEvent({
    event: {
      name: "quickAnswer",
      data: {
        action: "create",
        quickAnswer
      }
    }
  });

  // const io = getIO();
  // io.emit("quickAnswer", {
  //   action: "create",
  //   quickAnswer
  // });

  return res.status(200).json(quickAnswer);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { quickAnswerId } = req.params;

  const quickAnswer = await ShowQuickAnswerService(quickAnswerId);

  return res.status(200).json(quickAnswer);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const quickAnswerData: QuickAnswerData = req.body;

  const schema = Yup.object().shape({
    shortcut: Yup.string(),
    message: Yup.string()
  });

  try {
    await schema.validate(quickAnswerData);
  } catch (err) {
    throw new AppError(err.message);
  }

  const { quickAnswerId } = req.params;

  const quickAnswer = await UpdateQuickAnswerService({
    quickAnswerData,
    quickAnswerId
  });

  emitEvent({
    event: {
      name: "quickAnswer",
      data: {
        action: "update",
        quickAnswer
      }
    }
  });

  // const io = getIO();
  // io.emit("quickAnswer", {
  //   action: "update",
  //   quickAnswer
  // });

  return res.status(200).json(quickAnswer);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { quickAnswerId } = req.params;

  await DeleteQuickAnswerService(quickAnswerId);

  emitEvent({
    event: {
      name: "quickAnswer",
      data: {
        action: "delete",
        quickAnswerId
      }
    }
  });

  // const io = getIO();
  // io.emit("quickAnswer", {
  //   action: "delete",
  //   quickAnswerId
  // });

  return res.status(200).json({ message: "Quick Answer deleted" });
};
