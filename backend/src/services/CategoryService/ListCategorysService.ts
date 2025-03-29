import Category from "../../models/Category";
import Queue from "../../models/Queue";

const ListCategorysService = async ({
  queueIds = []
}: { queueIds?: number[] } = {}): Promise<Category[]> => {
  const categorys = await Category.findAll({
    order: [["name", "ASC"]],
    include: [
      ...(queueIds.length > 0
        ? [{ model: Queue, where: { id: queueIds }, required: true }]
        : [
            {
              model: Queue,
              as: "queues",
              required: false
            }
          ])
    ]
  });

  return categorys;
};

export default ListCategorysService;
