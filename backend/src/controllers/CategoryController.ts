import { Request, Response } from "express";
import { emitEvent } from "../libs/emitEvent";
import Category from "../models/Category";
import Queue from "../models/Queue";
import User from "../models/User";
import CreateCategoryService from "../services/CategoryService/CreateCategoryService";
import DeleteCategoryService from "../services/CategoryService/DeleteCategoryService";
import ListCategorysService from "../services/CategoryService/ListCategorysService";
import ShowCategoryService from "../services/CategoryService/ShowCategoryService";
import UpdateCategoryService from "../services/CategoryService/UpdateCategoryService";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const {
    filterByUserQueue: filterByUserQueueAsString,
    markByUserQueue: markByUserQueueAsString
  } = req.query;

  const filterByUserQueue = Boolean(filterByUserQueueAsString);
  const markByUserQueue = Boolean(markByUserQueueAsString);

  let userQueueIds = [];

  userQueueIds = (
    await User.findByPk(req.user.id, {
      include: [
        {
          model: Queue,
          as: "queues"
        }
      ]
    })
  ).queues.map(queue => queue.id);

  let categories = await ListCategorysService({
    queueIds: filterByUserQueue ? userQueueIds : []
  });

  if (markByUserQueue) {
    categories = categories.map(category => {
      category = category.toJSON() as Category;

      if (
        category.queues.length > 0 &&
        category.queues.find(queue => userQueueIds.includes(queue.id))
      ) {
        // @ts-ignore
        category.userHasThisCategory = true;
      } else {
        // @ts-ignore
        category.userHasThisCategory = false;
      }

      return category;
    });
  }

  return res.status(200).json(categories);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { name, color } = req.body;

  const category = await CreateCategoryService({
    name,
    color
  });

  emitEvent({
    event: {
      name: "category",
      data: {
        action: "update",
        category
      }
    }
  });

  // const io = getIO();
  // io.emit("category", {
  //   action: "update",
  //   category
  // });

  /* const ioClient = getIOClient();
  ioClient.emit("category", {
    action: "update",
    category
  }); */

  return res.status(200).json(category);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { categoryId } = req.params;

  const category = await ShowCategoryService(categoryId);

  return res.status(200).json(category);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { categoryId } = req.params;

  const category = await UpdateCategoryService(categoryId, req.body);

  emitEvent({
    event: {
      name: "category",
      data: {
        action: "update",
        category
      }
    }
  });

  // const io = getIO();
  // io.emit("category", {
  //   action: "update",
  //   category
  // });

  return res.status(201).json(category);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { categoryId } = req.params;

  await DeleteCategoryService(categoryId);

  emitEvent({
    event: {
      name: "category",
      data: {
        action: "delete",
        categoryId: +categoryId
      }
    }
  });

  // const io = getIO();
  // io.emit("category", {
  //   action: "delete",
  //   categoryId: +categoryId
  // });

  return res.status(200).send();
};
