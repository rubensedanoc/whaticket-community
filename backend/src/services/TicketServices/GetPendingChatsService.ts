import { Op } from "sequelize";
import Contact from "../../models/Contact";
import Queue from "../../models/Queue";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";

interface Request {
  whatsappIds?: number[];
  queueIds?: number[];
  userIds?: number[];
  accountManagerIds?: number[];
  status?: string[];
  waitingTimeRanges?: string[];
  limit?: number;
  isGroup?: boolean;
}

interface PendingChat {
  ticketId: number;
  contactName: string;
  contactNumber: string;
  lastMessage: string;
  lastMessageAt: Date;
  updatedAt: Date;
  pendingMinutes: number;
  status: string;
  queueId: number | null;
  queueName: string | null;
  queueColor: string | null;
  userId: number | null;
  userName: string | null;
  accountManagerId: number | null;
  accountManagerName: string | null;
  whatsappId: number;
  whatsappName: string;
  isGroup: boolean;
  unreadMessages: number;
  beenWaitingSinceTimestamp: number | null;
}

interface Response {
  total: number;
  data: PendingChat[];
}

const parseWaitingTimeRange = (rangeId: string): { min: number; max: number | null } => {
  const ranges: { [key: string]: { min: number; max: number | null } } = {
    "0-30": { min: 0, max: 30 },
    "30-60": { min: 30, max: 60 },
    "60-120": { min: 60, max: 120 },
    "120-240": { min: 120, max: 240 },
    "240-480": { min: 240, max: 480 },
    "480-960": { min: 480, max: 960 },
    "960-1440": { min: 960, max: 1440 },
    "1440-2880": { min: 1440, max: 2880 },
    "2880-4320": { min: 2880, max: 4320 },
    "4320+": { min: 4320, max: null }
  };
  return ranges[rangeId] || { min: 0, max: null };
};

const GetPendingChatsService = async ({
  whatsappIds = [],
  queueIds = [],
  userIds = [],
  accountManagerIds = [],
  status = ["open", "pending"],
  waitingTimeRanges = [],
  limit = 100,
  isGroup
}: Request): Promise<Response> => {
  const whereCondition: any = {
    status: {
      [Op.in]: status
    }
  };

  if (whatsappIds.length > 0) {
    whereCondition.whatsappId = {
      [Op.in]: whatsappIds
    };
  }

  if (queueIds.length > 0) {
    const hasNull = queueIds.includes(null as any);
    if (hasNull) {
      whereCondition[Op.or] = [
        { queueId: { [Op.in]: queueIds.filter(id => id !== null) } },
        { queueId: null }
      ];
    } else {
      whereCondition.queueId = {
        [Op.in]: queueIds
      };
    }
  }

  if (userIds.length > 0) {
    const hasNull = userIds.includes(null as any);
    if (hasNull) {
      whereCondition[Op.or] = [
        ...(whereCondition[Op.or] || []),
        { userId: { [Op.in]: userIds.filter(id => id !== null) } },
        { userId: null }
      ];
    } else {
      whereCondition.userId = {
        [Op.in]: userIds
      };
    }
  }

  if (isGroup !== undefined) {
    whereCondition.isGroup = isGroup;
  }

  if (accountManagerIds.length > 0) {
    const hasNull = accountManagerIds.includes(null as any);
    if (hasNull) {
      whereCondition[Op.or] = [
        ...(whereCondition[Op.or] || []),
        { accountManagerId: { [Op.in]: accountManagerIds.filter(id => id !== null) } },
        { accountManagerId: null }
      ];
    } else {
      whereCondition.accountManagerId = {
        [Op.in]: accountManagerIds
      };
    }
  }

  if (waitingTimeRanges.length > 0) {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const timeConditions: any[] = [];

    waitingTimeRanges.forEach(rangeId => {
      const { min, max } = parseWaitingTimeRange(rangeId);
      
      if (max === null) {
        const maxTimestamp = nowInSeconds - (min * 60);
        timeConditions.push({
          beenWaitingSinceTimestamp: {
            [Op.lte]: maxTimestamp,
            [Op.not]: null
          }
        });
      } else {
        const minTimestamp = nowInSeconds - (max * 60);
        const maxTimestamp = nowInSeconds - (min * 60);
        
        timeConditions.push({
          beenWaitingSinceTimestamp: {
            [Op.gte]: minTimestamp,
            [Op.lt]: maxTimestamp,
            [Op.not]: null
          }
        });
      }
    });

    whereCondition[Op.or] = [
      ...(whereCondition[Op.or] || []),
      ...timeConditions
    ];
  }

  const tickets = await Ticket.findAll({
    where: whereCondition,
    include: [
      {
        model: Contact,
        as: "contact",
        attributes: ["id", "name", "number", "traza_clientelicencia_currentetapaid"]
      },
      {
        model: Queue,
        as: "queue",
        attributes: ["id", "name", "color"]
      },
      {
        model: User,
        as: "user",
        attributes: ["id", "name"]
      },
      {
        model: User,
        as: "accountManager",
        attributes: ["id", "name"],
        required: false
      },
      {
        model: Whatsapp,
        as: "whatsapp",
        attributes: ["id", "name"]
      }
    ],
    order: [["updatedAt", "DESC"]],
    limit
  });

  const nowInSeconds = Date.now() / 1000;
  const data: PendingChat[] = tickets.map(ticket => {
    const waitingMinutes = ticket.beenWaitingSinceTimestamp
      ? Math.floor((nowInSeconds - ticket.beenWaitingSinceTimestamp) / 60)
      : 0;

    return {
      ticketId: ticket.id,
      contactName: ticket.contact?.name || "Sin nombre",
      contactNumber: ticket.contact?.number || "",
      contactEtapaId: (ticket.contact as any)?.traza_clientelicencia_currentetapaid || null,
      lastMessage: ticket.lastMessage || "",
      lastMessageAt: ticket.updatedAt,
      updatedAt: ticket.updatedAt,
      pendingMinutes: waitingMinutes,
      status: ticket.status,
      queueId: ticket.queueId,
      queueName: ticket.queue?.name || null,
      queueColor: ticket.queue?.color || null,
      userId: ticket.userId,
      userName: ticket.user?.name || null,
      accountManagerId: ticket.accountManagerId,
      accountManagerName: ticket.accountManager?.name || null,
      whatsappId: ticket.whatsappId,
      whatsappName: ticket.whatsapp?.name || "",
      isGroup: ticket.isGroup,
      unreadMessages: ticket.unreadMessages || 0,
      beenWaitingSinceTimestamp: ticket.beenWaitingSinceTimestamp
    };
  });

  return {
    total: data.length,
    data
  };
};

export default GetPendingChatsService;
