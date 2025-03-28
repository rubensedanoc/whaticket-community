import AppError from "../../errors/AppError";
import Queue from "../../models/Queue";
import QuickAnswer from "../../models/QuickAnswer";

const ShowQuickAnswerService = async (id: number): Promise<QuickAnswer> => {
  const quickAnswer = await QuickAnswer.findByPk(id, {
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

  return quickAnswer;
};

export default ShowQuickAnswerService;
