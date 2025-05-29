import AppError from "../../errors/AppError";
import Queue from "../../models/Queue";
import QuickAnswer from "../../models/QuickAnswer";

interface QuickAnswerData {
  slug?: string;
  shortcut?: string;
  message?: string;
  queueIds?: number[];
}

interface Request {
  quickAnswerData: QuickAnswerData;
  quickAnswerId: string;
}

const UpdateQuickAnswerService = async ({
  quickAnswerData,
  quickAnswerId
}: Request): Promise<QuickAnswer> => {
  const { slug, shortcut, message, queueIds = [] } = quickAnswerData;

  const quickAnswer = await QuickAnswer.findOne({
    where: { id: quickAnswerId },
    attributes: ["id", "shortcut", "message"],
    include: [
      {
        model: Queue,
        as: "queues",
        required: false
      }
    ]
  });

  if (!quickAnswer) {
    throw new AppError("ERR_NO_QUICK_ANSWERS_FOUND", 404);
  }
  await quickAnswer.update({
    slug,
    shortcut,
    message
  });

  await quickAnswer.$set("queues", queueIds);

  await quickAnswer.reload();

  return quickAnswer;
};

export default UpdateQuickAnswerService;
