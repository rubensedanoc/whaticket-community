import { Request, Response } from "express";

import AppError from "../errors/AppError";
import CheckSettingsHelper from "../helpers/CheckSettings";

import { emitEvent } from "../libs/emitEvent";
import CreateUserService from "../services/UserServices/CreateUserService";
import DeleteUserService from "../services/UserServices/DeleteUserService";
import ListUsersService from "../services/UserServices/ListUsersService";
import ShowUserService from "../services/UserServices/ShowUserService";
import UpdateUserService from "../services/UserServices/UpdateUserService";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
  withPagination: string;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const {
    searchParam,
    pageNumber,
    withPagination: withPaginationAsString
  } = req.query as IndexQuery;

  const { users, count, hasMore } = await ListUsersService({
    searchParam,
    pageNumber,
    ...(withPaginationAsString && {
      withPagination: JSON.parse(withPaginationAsString)
    })
  });

  return res.json({ users, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { email, password, name, profile, queueIds, whatsappId } = req.body;

  if (
    req.url === "/signup" &&
    (await CheckSettingsHelper("userCreation")) === "disabled"
  ) {
    throw new AppError("ERR_USER_CREATION_DISABLED", 403);
  } else if (req.url !== "/signup" && req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const user = await CreateUserService({
    email,
    password,
    name,
    profile,
    queueIds,
    whatsappId
  });

  emitEvent({
    event: {
      name: "user",
      data: {
        action: "create",
        user
      }
    }
  });

  // const io = getIO();
  // io.emit("user", {
  //   action: "create",
  //   user
  // });

  return res.status(200).json(user);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { userId } = req.params;

  const user = await ShowUserService(userId);

  return res.status(200).json(user);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { userId } = req.params;
  const userData = req.body;

  const user = await UpdateUserService({ userData, userId });

  emitEvent({
    event: {
      name: "user",
      data: {
        action: "update",
        user
      }
    }
  });

  // const io = getIO();
  // io.emit("user", {
  //   action: "update",
  //   user
  // });

  return res.status(200).json(user);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { userId } = req.params;

  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  await DeleteUserService(userId);

  emitEvent({
    event: {
      name: "user",
      data: {
        action: "delete",
        userId
      }
    }
  });

  // const io = getIO();
  // io.emit("user", {
  //   action: "delete",
  //   userId
  // });

  return res.status(200).json({ message: "User deleted" });
};
