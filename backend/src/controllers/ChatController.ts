import { Request, Response } from "express";
import GetPendingChatsService from "../services/TicketServices/GetPendingChatsService";

export const getPendingChats = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const {
    whatsappIds: whatsappIdsString,
    queueIds: queueIdsString,
    userIds: userIdsString,
    accountManagerIds: accountManagerIdsString,
    status: statusString,
    waitingTimeRanges: waitingTimeRangesString,
    limit: limitString,
    isGroup: isGroupString
  } = req.query;

  let whatsappIds: number[] = [];
  let queueIds: number[] = [];
  let userIds: number[] = [];
  let accountManagerIds: number[] = [];
  let status: string[] = ["open", "pending"];
  let waitingTimeRanges: string[] = [];
  let limit = 100;
  let isGroup: boolean | undefined;

  if (whatsappIdsString) {
    try {
      whatsappIds = JSON.parse(whatsappIdsString as string);
    } catch (e) {
      whatsappIds = [parseInt(whatsappIdsString as string, 10)];
    }
  }

  if (queueIdsString) {
    try {
      queueIds = JSON.parse(queueIdsString as string);
    } catch (e) {
      queueIds = [parseInt(queueIdsString as string, 10)];
    }
  }

  if (userIdsString) {
    try {
      userIds = JSON.parse(userIdsString as string);
    } catch (e) {
      userIds = [parseInt(userIdsString as string, 10)];
    }
  }

  if (accountManagerIdsString) {
    try {
      accountManagerIds = JSON.parse(accountManagerIdsString as string);
    } catch (e) {
      accountManagerIds = [parseInt(accountManagerIdsString as string, 10)];
    }
  }

  if (statusString) {
    try {
      status = JSON.parse(statusString as string);
    } catch (e) {
      status = [statusString as string];
    }
  }

  if (waitingTimeRangesString) {
    try {
      waitingTimeRanges = JSON.parse(waitingTimeRangesString as string);
    } catch (e) {
      waitingTimeRanges = [waitingTimeRangesString as string];
    }
  }

  if (limitString) {
    limit = parseInt(limitString as string, 10);
  }

  if (isGroupString) {
    isGroup = isGroupString === "true" || isGroupString === "1";
  }

  const result = await GetPendingChatsService({
    whatsappIds,
    queueIds,
    userIds,
    accountManagerIds,
    status,
    waitingTimeRanges,
    limit,
    isGroup
  });

  return res.status(200).json(result);
};
