import { Request, Response } from "express";

import AppError from "../errors/AppError";
import ListNotificationsService from "../services/NotificationService/ListNotificationsService";
import Notification from "../models/Notification";
import ShowNotificationService from "../services/NotificationService/ShowNotificationService";
import { NOTIFICATIONTYPES } from "../constants";
import { emitEvent } from "../libs/emitEvent";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
  seen: string;
  showAll: string;
  queueIds: string;
  whatsappIds: string;
  marketingCampaignIds: string;
  typeIds: string;
  showOnlyMyGroups: string;
  categoryId: string;
  showOnlyWaitingTickets: string;
  filterByUserQueue: string;
  selectedUsersIds: string;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const {
    pageNumber,
    searchParam,
    seen: seenStringified,
    selectedUsersIds: stringifiedSelectedUsersIds,
  } = req.query as IndexQuery;

  const userId = req.user.id;

  let seen: boolean | undefined;
  let selectedUsersIds: number[] | undefined;

  if (seenStringified) {
    seen = JSON.parse(seenStringified);
  }

  if (stringifiedSelectedUsersIds) {
    selectedUsersIds = JSON.parse(stringifiedSelectedUsersIds);
  }

  let { tickets, count, hasMore, whereCondition, includeCondition } =
    await ListNotificationsService({
      searchParam,
      pageNumber,
      seen,
      userId,
      selectedUsersIds,
    });

  let ticketsToSend = tickets; // Inicializamos con la lista original

  return res.status(200).json({
    tickets: ticketsToSend,
    count,
    hasMore,
    whereCondition,
    includeCondition
  });
};

export const seenNotification = async (req: Request, res: Response): Promise<Response> => {
  const { notificationId } = req.body;

  if (!notificationId) {
    throw new AppError("Missing notification ID", 400);
  }

  try {
    await Notification.update({ seen: true }, { where: { id: notificationId } });

    const notification = await ShowNotificationService(
      notificationId
    )

    emitEvent({
      event: {
        name: "notification",
        data: {
          action: NOTIFICATIONTYPES.GROUP_MENTION_UPDATE,
          data: notification
        }
      }
    })

    return res.status(200).json({ message: "Notification marked as seen" });
  } catch (error) {
    throw new AppError("Error marking notification as seen", 500);
  }
};

export const getNotificationsCountForUser = async (req: Request, res: Response): Promise<Response> => {
  const userId = req.user.id;

  try {
    const count = await Notification.count({
      where: {
        toUserId: userId,
        seen: false
      }
    });

    return res.status(200).json({ count });
  } catch (error) {
    throw new AppError("Error fetching notification count", 500);
  }
}
