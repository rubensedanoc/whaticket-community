import AppError from "../../errors/AppError";
import QuickAnswer from "../../models/QuickAnswer";
import ShowQuickAnswerService from "./ShowQuickAnswerService";

interface Request {
  shortcut: string;
  message: string;
  queueIds?: number[];
}

const CreateQuickAnswerService = async ({
  shortcut,
  message,
  queueIds = []
}: Request): Promise<QuickAnswer> => {
  const nameExists = await QuickAnswer.findOne({
    where: { shortcut }
  });

  if (nameExists) {
    throw new AppError("ERR__SHORTCUT_DUPLICATED");
  }

  let quickAnswer = await QuickAnswer.create({ shortcut, message });

  await quickAnswer.$set("queues", queueIds);

  quickAnswer = await ShowQuickAnswerService(quickAnswer.id);

  return quickAnswer;
};

export default CreateQuickAnswerService;
