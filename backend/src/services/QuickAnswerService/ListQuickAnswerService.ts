import { Sequelize } from "sequelize";
import Queue from "../../models/Queue";
import QuickAnswer from "../../models/QuickAnswer";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  queueIds?: number[];
}

interface Response {
  quickAnswers: QuickAnswer[];
  count: number;
  hasMore: boolean;
}

const ListQuickAnswerService = async ({
  searchParam = "",
  pageNumber = "1",
  queueIds = []
}: Request): Promise<Response> => {
  const whereCondition = {
    message: Sequelize.where(
      Sequelize.fn("LOWER", Sequelize.col("message")),
      "LIKE",
      `%${searchParam.toLowerCase().trim()}%`
    )
  };
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: quickAnswers } = await QuickAnswer.findAndCountAll({
    where: whereCondition,
    include: [
      ...(queueIds.length > 0
        ? [{ model: Queue, where: { id: queueIds }, required: true }]
        : [
            {
              model: Queue,
              as: "queues",
              attributes: ["id", "name", "color"],
              required: false
            }
          ])
    ],
    // limit,
    // offset,
    order: [["message", "ASC"]]
  });

  // const hasMore = count > offset + quickAnswers.length;
  const hasMore = false;

  return {
    quickAnswers,
    count,
    hasMore
  };
};

export default ListQuickAnswerService;
