import { addHours, differenceInSeconds, format } from "date-fns";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { Request, Response } from "express";
import { Op, QueryTypes } from "sequelize";
import Category from "../models/Category";
import Contact from "../models/Contact";
import Message from "../models/Message";
import Queue from "../models/Queue";
import Ticket from "../models/Ticket";
import User from "../models/User";
import Whatsapp from "../models/Whatsapp";
import {
  convertDateStrToTimestamp,
  formatDate,
  formatDateToMySQL,
  groupDateWithRange,
  processMessageTicketClosed,
  processMessageTicketPendingOrOpen,
  processTicketMessagesForReturnIATrainingData,
  secondsToDhms
} from "../utils/util";

dayjs.extend(utc);
dayjs.extend(timezone);

type IndexQuery = {
  fromDate: string;
  toDate: string;
  selectedWhatsappIds: string;
  selectedCountryIds?: string;
  selectedTypes?: string;
  selectedQueueIds?: string;
};

function findLast<T>(array: T[], callback: any): T | undefined {
  // Iterar desde el final del array hacia el principio
  for (let i = array.length - 1; i >= 0; i--) {
    // Si el callback devuelve true para el elemento actual, devolver ese elemento
    if (callback(array[i], i, array)) {
      return array[i];
    }
  }
  // Si no se encuentra ningún elemento que cumpla con la condición, devolver undefined
  return undefined;
}

function getEndOfDayInSeconds(dateString) {
  // Crear una fecha a partir de la cadena de entrada
  const date = new Date(dateString);

  // Crear una nueva fecha para el final del día en UTC
  const endOfDayUTC = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );

  // Obtener los milisegundos desde la época y convertir a segundos
  const endOfDaySeconds = Math.floor(endOfDayUTC.getTime() / 1000);

  return endOfDaySeconds;
}

function transformTicketsData(
  tickets,
  startDate,
  endDate,
  dateProperty = "createdAt"
) {
  console.log("transformTicketsData", { startDate, endDate });

  // Verificar si el rango de fechas es solo un día
  const isSingleDay = isSameDay(startDate, endDate);

  // Crear un objeto de fechas dentro del rango especificado
  const dateMap = {};
  let currentDate = new Date(startDate);

  if (isSingleDay) {
    // Si el rango es solo un día, agrupar por hora
    while (currentDate <= endDate) {
      const isoDate = currentDate.toISOString().split("T")[0];
      const hour = currentDate.getUTCHours();
      dateMap[`${isoDate} ${hour.toString().padStart(2, "0")}:00`] = 0;
      currentDate = addHours(currentDate, 1);
    }
  } else {
    // Si el rango abarca más de un día, agrupar por día
    while (currentDate <= endDate) {
      const isoDate = currentDate.toISOString().split("T")[0];
      dateMap[isoDate] = 0; // Inicializar contador en 0 para cada día
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  // Contar los tickets por fecha
  const groupedTickets = tickets.reduce((acc, ticket) => {
    let dateAsDate = ticket[dateProperty] as Date;
    let dateAsString = dateAsDate.toISOString();

    console.log("Verificar el ticket esta dentro del rango: ", {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      dateAsString
    });

    // Verificar que la fecha esté dentro del rango especificado
    if (
      dateAsString >= startDate.toISOString() &&
      dateAsString <= endDate.toISOString()
    ) {
      if (isSingleDay) {
        // Agrupar por hora si el rango es un día
        const isoDate = dateAsString.split("T")[0];
        const hour = dateAsDate.getUTCHours();
        acc[`${isoDate} ${hour.toString().padStart(2, "0")}:00`]++;
      } else {
        // Agrupar por día si el rango abarca más de un día
        const isoDate = dateAsString.split("T")[0];
        acc[isoDate]++;
      }
    }

    return acc;
  }, dateMap);

  console.log("chartData", groupedTickets);

  // Convertir el objeto en un array de objetos
  const chartData = Object.keys(groupedTickets).map(date => ({
    date,
    count: groupedTickets[date]
  }));

  // Ordenar los datos por fecha
  chartData.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return chartData;
}

// Función para verificar si dos fechas son del mismo día
function isSameDay(date1, date2) {
  console.log("isSameDay", date1.toISOString(), date2.toISOString());

  return (
    date1.toISOString().split("T")[0] === date2.toISOString().split("T")[0]
  );
}

export const generalReport = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const {
    fromDate: fromDateAsString,
    toDate: toDateAsString,
    selectedWhatsappIds: selectedUserIdsAsString
  } = req.query as IndexQuery;

  console.log({ fromDateAsString, toDateAsString });

  // Parse the date strings without converting to UTC
  const fromDate = new Date(fromDateAsString.replace(/-05:00$/, "Z"));
  const toDate = new Date(toDateAsString.replace(/-05:00$/, "Z"));

  console.log({ fromDate, toDate });

  let createdTicketsChartData: null | any[] = null;
  let createdTicketsData: null | Ticket[] = null;
  let createdTicketsCount: null | number = null;
  let tprData: null | any = null;
  let tprPromedio: null | number = null;
  let createdTicketsClosedInTheRangeTimeChartData: null | any[] = null;
  let createdTicketsClosedInTheRangeTimeData: null | Ticket[] = null;
  let createdTicketsClosedInTheRangeTimeCount: null | number = null;
  let tdrData: null | any = null;
  let tdrPromedio: null | number = null;

  const selectedWhatsappIds = JSON.parse(selectedUserIdsAsString) as number[];

  const createdTickets = await Ticket.findAll({
    where: {
      createdAt: {
        [Op.gte]: dayjs(fromDateAsString).utc().toDate(),
        [Op.lte]: dayjs(toDateAsString).utc().toDate()
      },
      isGroup: false,
      ...(selectedWhatsappIds.length > 0 && {
        whatsappId: {
          [Op.in]: selectedWhatsappIds
        }
      })
    },
    include: [
      {
        model: Message,
        as: "messages",
        order: [["timestamp", "ASC"]],
        required: false,
        separate: true
      },
      {
        model: Contact,
        as: "contact",
        required: false
      },
      {
        model: User,
        as: "user",
        required: false
      },
      {
        model: Whatsapp,
        as: "whatsapp",
        required: false
      }
    ]
  });

  let createdTicketsWithClientHours = createdTickets.map(ticket => {
    const modifiedTicket = JSON.parse(JSON.stringify(ticket)) as Ticket;

    modifiedTicket.createdAt = dayjs(modifiedTicket.createdAt)
      .subtract(5, "hours")
      .toDate();
    modifiedTicket.updatedAt = dayjs(modifiedTicket.updatedAt)
      .subtract(5, "hours")
      .toDate();

    return modifiedTicket;
  });

  createdTicketsData = createdTicketsWithClientHours;
  createdTicketsChartData = transformTicketsData(
    createdTicketsWithClientHours,
    fromDate,
    toDate
  );
  createdTicketsCount = createdTicketsWithClientHours.length;

  // console.log({
  //   createdTicketsCount: createdTickets.length,
  //   createdTickets: createdTickets.map(row => {
  //     return { id: row.id, lastMessage: row.lastMessage };
  //   })
  // });

  const createdTicketsWithFirstClientMessage =
    createdTicketsWithClientHours.filter(
      ticket =>
        ticket.messages?.length > 0 && ticket.messages[0].fromMe === false
    );

  const createdTicketsClosedInTheRangeTime =
    createdTicketsWithClientHours.filter(ticket => {
      const lastCloseMessage = findLast(ticket.messages, (message: Message) => {
        return message.body.includes("*resolvió* la conversación");
      });

      // console.log("createdTicketsClosedInTheRangeTime", {
      //   lastCloseMessage,
      //   dateConlaQueSeVaAComparar: getEndOfDayInSeconds(toDateAsString),
      //   lastCloseMessageTimestampIsValid:
      //     lastCloseMessage?.timestamp < getEndOfDayInSeconds(toDateAsString),
      //   ticketStatus: ticket.status === "closed"
      // });

      return (
        lastCloseMessage &&
        lastCloseMessage.timestamp < getEndOfDayInSeconds(toDateAsString) &&
        ticket.status === "closed"
      );
    });

  if (createdTicketsClosedInTheRangeTime.length > 0) {
    createdTicketsClosedInTheRangeTimeData = createdTicketsClosedInTheRangeTime;
    createdTicketsClosedInTheRangeTimeCount =
      createdTicketsClosedInTheRangeTime.length;
    createdTicketsClosedInTheRangeTimeChartData = transformTicketsData(
      createdTicketsClosedInTheRangeTime,
      fromDate,
      toDate,
      "updatedAt"
    );

    // console.log({
    //   createdTicketsClosedInTheRangeTimeCount:
    //     createdTicketsClosedInTheRangeTime.length,
    //   createdTicketsClosedInTheRangeTime:
    //     createdTicketsClosedInTheRangeTime.map(row => {
    //       return { id: row.id, lastMessage: row.lastMessage };
    //     })
    // });

    tdrData = createdTicketsClosedInTheRangeTime.map(ticket => {
      const firstMessage = ticket.messages[0];
      const lastMessage = ticket.messages[ticket.messages.length - 1];

      const firstMessageTimestamp = firstMessage.timestamp;
      const lastMessageTimestamp = lastMessage.timestamp;

      return {
        ticket: ticket,
        tdrItem: lastMessageTimestamp - firstMessageTimestamp,
        tdrFirstMessage: firstMessage,
        tdrFirstUserMessage: lastMessage
      };
    });
    tdrPromedio =
      tdrData.reduce((acc, row) => acc + row.tdrItem, 0) / tdrData.length;
  } else {
    createdTicketsClosedInTheRangeTimeCount = 0;
    // console.log("----- No hay tickets cerrados en el rango de tiempo");
  }

  // const

  if (createdTicketsWithFirstClientMessage.length > 0) {
    tprData = createdTicketsWithFirstClientMessage.map(ticket => {
      const firstMessage = ticket.messages[0];
      const firstUserMessage = ticket.messages.find(
        message => message.fromMe === true
      );

      const firstMessageTimestamp = firstMessage.timestamp;
      const firstUserMessageTimestamp = firstUserMessage
        ? firstUserMessage.timestamp
        : Date.now() / 1000;

      return {
        ticket: ticket,
        tprItem: firstUserMessageTimestamp - firstMessageTimestamp,
        tprFirstMessage: firstMessage,
        tprFirstUserMessage: firstUserMessage
      };
    });
    tprPromedio =
      tprData.reduce((acc, row) => acc + row.tprItem, 0) / tprData.length;

    // console.log({
    //   createdTicketsWithFirstClientMessageCount:
    //     createdTicketsWithFirstClientMessage.length,
    //   createdTicketsWithFirstClientMessage:
    //     createdTicketsWithFirstClientMessage.map(row => {
    //       return { id: row.id, lastMessage: row.lastMessage };
    //     }),
    //   tprData,
    //   tprPromedio:
    //     tprData.reduce((acc, row) => acc + row.tprItem, 0) / tprData.length
    // });
  }

  return res.status(200).json({
    createdTicketsChartData,
    createdTicketsData,
    createdTicketsCount,
    tprData,
    tprPromedio,
    createdTicketsClosedInTheRangeTimeChartData,
    createdTicketsClosedInTheRangeTimeData,
    createdTicketsClosedInTheRangeTimeCount,
    tdrData,
    tdrPromedio
  });
};

export const getOpenOrPendingTicketsWithLastMessages = async (
  req: Request,
  res: Response
): Promise<Response> => {
  console.log("---------------getOpenOrPendingTicketsWithLastMessages");

  const { selectedWhatsappIds: selectedUserIdsAsString } =
    req.query as IndexQuery;

  const selectedWhatsappIds = JSON.parse(selectedUserIdsAsString) as number[];

  const ticketsWithAllMessages = await Ticket.findAll({
    where: {
      status: { [Op.or]: ["open", "pending"] },
      ...(selectedWhatsappIds.length > 0 && {
        whatsappId: {
          [Op.in]: selectedWhatsappIds
        }
      })
    },
    include: [
      {
        model: Message,
        as: "messages",
        order: [["timestamp", "DESC"]],
        required: false,
        limit: 25,
        separate: true,
        include: [
          {
            model: Contact,
            as: "contact",
            required: false
          }
        ]
      }
    ]
  });

  ticketsWithAllMessages.forEach(ticket => {
    ticket.messages.sort((a, b) => a.timestamp - b.timestamp);
  });

  return res.status(200).json({ ticketsWithAllMessages });
};

export const getATicketsList = async (
  req: Request,
  res: Response
): Promise<Response> => {
  console.log("---------------getATicketsList");

  const { ticketIds: ticketIdsAsString } = req.query as {
    ticketIds: string;
  };

  // console.log({ ticketIdsAsString });

  const ticketIds = JSON.parse(ticketIdsAsString) as number[];

  const tickets = await Ticket.findAll({
    where: {
      id: {
        [Op.in]: ticketIds
      }
    },
    include: [
      {
        model: Contact,
        as: "contact",
        required: false
      },
      {
        model: User,
        as: "user",
        required: false
      },
      {
        model: Queue,
        as: "queue",
        attributes: ["id", "name", "color"],
        required: false
      },
      {
        model: Whatsapp,
        as: "whatsapp",
        attributes: ["name"],
        required: false
      },
      {
        model: Category,
        as: "categories",
        attributes: ["id", "name", "color"]
      },
      {
        model: User,
        as: "helpUsers",
        required: false
      },
      {
        model: User,
        as: "participantUsers",
        required: false
      }
    ]
  });

  const ticketsWithClientTimeWaiting = await getClientTimeWaitingForTickets(
    tickets
  );

  console.log(
    "ticketsWithClientTimeWaiting: ",
    ticketsWithClientTimeWaiting.map(t => ({
      id: t.id,
      clientTimeWaiting: t.clientTimeWaiting
    }))
  );

  return res.status(200).json({
    tickets: ticketsWithClientTimeWaiting
  });
};

export const getClientTimeWaitingForTickets = async (tickets: Ticket[]) => {
  if (tickets.length === 0) {
    return tickets;
  }

  try {
    let whatasappListIDS: any = await Whatsapp.sequelize.query(
      "SELECT * FROM Whatsapps WHERE number IS NOT NULL AND number != '' ",
      { type: QueryTypes.SELECT }
    );

    whatasappListIDS = whatasappListIDS
      .map(whatasapp => `'${whatasapp.number}'`)
      .join(",");

    const ticketListIDS = tickets.map(ticket => `'${ticket.id}'`).join(",");

    // console.log("----ticketIds", ticketListIDS);

    const sql = `SELECT
          t.id,
      t.createdAt,
      t.contactId,
      t.status,
      t.isGroup,
      t.whatsappId,
      MIN(CASE
          WHEN t.id = m.ticketId
            AND (m.isPrivate IS NULL OR m.isPrivate != '1')
            AND m.fromMe != 1
            AND (c.isCompanyMember IS NULL OR c.isCompanyMember != '1')
            AND c.number NOT IN (${whatasappListIDS})
          THEN m.timestamp
          END) as dateFirstMessageClient,
      MIN(
      CASE
          WHEN t.id = m.ticketId
          AND (m.isPrivate IS NULL OR m.isPrivate != '1')
          THEN m.timestamp
          END) as dateFistMessageTicket,
      (
      SELECT MIN(m_inner.timestamp)
      FROM Messages m_inner
      LEFT JOIN Contacts c_inner ON m_inner.contactId = c_inner.id
      WHERE
        m_inner.ticketId = t.id
        AND (m_inner.isPrivate IS NULL OR m_inner.isPrivate != '1')
        AND m_inner.fromMe != '1'
        AND (c_inner.isCompanyMember IS NULL OR c_inner.isCompanyMember != '1')
        AND c_inner.number NOT IN (${whatasappListIDS})
        AND m_inner.timestamp >
          (SELECT MAX(mcs.timestamp)
          FROM Messages mcs
          LEFT JOIN Contacts c_sub ON mcs.contactId = c_sub.id
          WHERE mcs.ticketId = t.id
          AND (mcs.body NOT LIKE CONCAT(UNHEX('E2808E'), '%')
              AND (mcs.isPrivate IS NULL OR mcs.isPrivate != 1)
              AND (mcs.fromMe = 1
              OR c_sub.isCompanyMember = '1'
              OR c_sub.number IN (${whatasappListIDS})))
          )
      ) as dateFirstLastMessageClient,
      MAX(CASE
        WHEN t.id = m.ticketId
          AND m.body NOT LIKE CONCAT(UNHEX('E2808E'), '%')
          AND (m.isPrivate IS NULL OR m.isPrivate != 1)
          AND (m.fromMe = 1
          OR c.isCompanyMember = '1'
          OR c.number IN (${whatasappListIDS}))
        THEN m.timestamp
        END) as dateLastMessageCS,
      MIN(CASE
          WHEN t.id = m.ticketId
            AND m.body NOT LIKE CONCAT(UNHEX('E2808E'), '%')
            AND (m.isPrivate IS NULL OR m.isPrivate != 1)
            AND (m.fromMe = 1
            OR c.isCompanyMember = '1'
            OR c.number IN (${whatasappListIDS}) )
          THEN m.timestamp
          END) as dateFirstMessageCS
    FROM Tickets t
    INNER JOIN Messages m ON t.id = m.ticketId
    LEFT JOIN Contacts c ON m.contactId = c.id
    WHERE t.id in (${ticketListIDS})
    GROUP BY t.id `;

    const ticketListFind = await Ticket.sequelize.query(sql, {
      type: QueryTypes.SELECT
    });

    ticketListFind.forEach((ticket: any) => {
      let withResponse = false;
      /**
       * Si no existe dateFirstLastMessageClient quiere decir que el CS comenzo a hablar y el cliente no responde
       * Valido que exista un primer mensaje ultimo del cliente
       * para despues comparar el timestamp del ultimo mensajes del CS
       * Si existe se afirmaria que habiado al menos una respuesta
       * ahorta tocaria validar que el timestamp del CS sea mayor al ultimo mensaje del cliente
       */
      /**
       * Para esta caso es que no hubo timestamp
       */
      if (
        ticket?.dateFirstMessageClient === null &&
        ticket?.dateFistMessageTicket === null &&
        ticket?.dateFirstLastMessageClient === null &&
        ticket?.dateLastMessageCS === null &&
        ticket?.dateFirstMessageCS === null
      ) {
        ticket.timeAuxCreated = convertDateStrToTimestamp(ticket.createdAt);
        ticket.dateFistMessageTicket = ticket.timeAuxCreated;
        ticket.dateFirstLastMessageClient = ticket.dateFistMessageTicket;
      }
      if (
        (ticket?.dateFirstLastMessageClient === null &&
          ticket?.dateFirstMessageCS === null &&
          ticket?.dateFistMessageTicket !== null &&
          ticket?.dateFirstMessageClient !== null &&
          ticket?.dateFistMessageTicket !== ticket?.dateFirstMessageClient) ||
        (ticket?.dateFirstLastMessageClient === null &&
          ticket?.dateLastMessageCS !== null) ||
        (ticket.dateLastMessageCS !== null &&
          ticket.dateFirstLastMessageClient !== null &&
          ticket.dateLastMessageCS > ticket.dateFirstLastMessageClient)
      ) {
        withResponse = true;
      }

      if (!withResponse) {
        let timeStampValidate = null;
        if (ticket.dateFirstLastMessageClient !== null) {
          timeStampValidate = ticket.dateFirstLastMessageClient;
        } else if (ticket.dateFirstMessageClient !== null) {
          timeStampValidate = ticket.dateFirstMessageClient;
        } else if (ticket.dateFistMessageTicket !== null) {
          timeStampValidate = ticket.dateFistMessageTicket;
        }
        if (timeStampValidate !== null) {
          // console.log("ticket.id", ticket.id);
          // console.log(
          //   "clientTimeWaiting",
          //   differenceInSeconds(new Date(), new Date(timeStampValidate * 1000))
          // );

          tickets.find(t => t.id === ticket.id).clientTimeWaiting =
            timeStampValidate;
        }
      }
    });
  } catch (error) {
    console.log("-------------------error", error);
  }

  // console.log(
  //   "return ticketssss: ",
  //   tickets.map(t => ({ id: t.id, clientTimeWaiting: t.clientTimeWaiting }))
  // );

  return tickets;
};

export const reportHistory = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const {
    selectedWhatsappIds: selectedUserIdsAsString,
    selectedCountryIds: selectedCountryIdsAsString,
    selectedTypes: selectedTypesAsString,
    selectedQueueIds: selectedQueueIdsAsString
  } = req.query as IndexQuery;

  const selectedWhatsappIds = JSON.parse(selectedUserIdsAsString) as string[];
  const selectedCountryIds = JSON.parse(selectedCountryIdsAsString) as string[];
  const selectedTypes = JSON.parse(selectedTypesAsString) as string[];
  const selectedQueueIds = JSON.parse(selectedQueueIdsAsString) as string[];
  const logsTime = [];
  let sqlWhereAdd = " t.status IN ('pending','open') ";
  // const sqlWhereAdd = " t.id = 3318 ";

  if (selectedWhatsappIds.length > 0) {
    sqlWhereAdd += ` AND t.whatsappId IN (${selectedWhatsappIds.join(",")}) `;
  }

  if (selectedQueueIds.length > 0) {
    if (!selectedQueueIds.includes(null)) {
      sqlWhereAdd += ` AND t.queueId IN (${selectedQueueIds.join(",")}) `;
    } else {
      if (selectedQueueIds.length === 1) {
        sqlWhereAdd += ` AND t.queueId IS NULL`;
      } else {
        sqlWhereAdd += ` AND (t.queueId IN (${selectedQueueIds
          .filter(q => q !== null)
          .join(",")}) OR t.queueId IS NULL)`;
      }
    }
  }
  if (selectedCountryIds.length > 0) {
    sqlWhereAdd += ` AND ct.countryId IN (${selectedCountryIds.join(",")}) `;
  }
  if (selectedTypes.length === 1) {
    if (selectedTypes.includes("individual")) {
      sqlWhereAdd += ` AND t.isGroup = 0 `;
    }
    if (selectedTypes.includes("group")) {
      sqlWhereAdd += ` AND t.isGroup = 1 `;
    }
  }
  logsTime.push(`Whatasappnew-inicio: ${Date()}`);
  let whatasappListIDS: any = await Whatsapp.sequelize.query(
    "SELECT * FROM Whatsapps WHERE number IS NOT NULL AND number != '' ",
    { type: QueryTypes.SELECT }
  );
  logsTime.push(`Whatasappnew-fin: ${Date()}`);
  whatasappListIDS = whatasappListIDS
    .map(whatasapp => `'${whatasapp.number}'`)
    .join(",");

  const sql = `SELECT
    t.id,
    t.createdAt,
    t.contactId,
    t.status,
    t.isGroup,
    t.whatsappId,
    MIN(CASE
        WHEN t.id = m.ticketId
          AND (m.isPrivate IS NULL OR m.isPrivate != '1')
          AND m.fromMe != 1
          AND (c.isCompanyMember IS NULL OR c.isCompanyMember != '1')
          AND c.number NOT IN (${whatasappListIDS})
        THEN m.timestamp
        END) as dateFirstMessageClient,
    MIN(
    CASE
        WHEN t.id = m.ticketId
        AND (m.isPrivate IS NULL OR m.isPrivate != '1')
        THEN m.timestamp
        END) as dateFistMessageTicket,
    (
    SELECT MIN(m_inner.timestamp)
    FROM Messages m_inner
    LEFT JOIN Contacts c_inner ON m_inner.contactId = c_inner.id
    WHERE
      m_inner.ticketId = t.id
      AND (m_inner.isPrivate IS NULL OR m_inner.isPrivate != '1')
      AND m_inner.fromMe != '1'
      AND (c_inner.isCompanyMember IS NULL OR c_inner.isCompanyMember != '1')
      AND c_inner.number NOT IN (${whatasappListIDS})
      AND m_inner.timestamp >
        (SELECT MAX(mcs.timestamp)
        FROM Messages mcs
        LEFT JOIN Contacts c_sub ON mcs.contactId = c_sub.id
        WHERE mcs.ticketId = t.id
        AND (mcs.body NOT LIKE CONCAT(UNHEX('E2808E'), '%')
            AND (mcs.isPrivate IS NULL OR mcs.isPrivate != 1)
            AND (mcs.fromMe = 1
            OR c_sub.isCompanyMember = '1'
            OR c_sub.number IN (${whatasappListIDS})))
        )
    ) as dateFirstLastMessageClient,
    MAX(CASE
      WHEN t.id = m.ticketId
        AND m.body NOT LIKE CONCAT(UNHEX('E2808E'), '%')
        AND (m.isPrivate IS NULL OR m.isPrivate != 1)
        AND (m.fromMe = 1
        OR c.isCompanyMember = '1'
        OR c.number IN (${whatasappListIDS}))
      THEN m.timestamp
      END) as dateLastMessageCS,
    MIN(CASE
        WHEN t.id = m.ticketId
          AND m.body NOT LIKE CONCAT(UNHEX('E2808E'), '%')
          AND (m.isPrivate IS NULL OR m.isPrivate != 1)
          AND (m.fromMe = 1
          OR c.isCompanyMember = '1'
          OR c.number IN (${whatasappListIDS}) )
        THEN m.timestamp
        END) as dateFirstMessageCS
  FROM Tickets t
  LEFT JOIN Contacts ct ON t.contactId = ct.id
  INNER JOIN Messages m ON t.id = m.ticketId
  LEFT JOIN Contacts c ON m.contactId = c.id
  WHERE
  ${sqlWhereAdd}
  GROUP BY t.id `;
  console.log("sql", sql);

  /**
   * Obtengo todos los tickets acortandolos a los filtros de ticken que me pasen
   * # sudo lsof -i :8080
     # sudo kill -9 8515
   */
  const ticketListFind = await Ticket.sequelize.query(sql, {
    type: QueryTypes.SELECT
  });
  logsTime.push(`sql-fin: ${Date()}`);
  /**
   * Los agrupos por para obtener los mensajes del ticket
   */

  const timesQuintalWaitingResponse = [
    { label: "0 - 1 Horas", min: 0, max: 1, count: 0, ticketIds: [] },
    { label: "1 - 2 Horas", min: 1, max: 2, count: 0, ticketIds: [] },
    { label: "2 - 3 Horas", min: 2, max: 3, count: 0, ticketIds: [] },
    { label: "3 - 4 Horas", min: 3, max: 4, count: 0, ticketIds: [] },
    { label: "4 - 5 Horas", min: 4, max: 5, count: 0, ticketIds: [] },
    { label: "0 - 5 Horas", min: 0, max: 5, count: 0, ticketIds: [] },
    { label: "5 - 10 Horas", min: 5, max: 10, count: 0, ticketIds: [] },
    { label: "10 - 15 Horas", min: 10, max: 15, count: 0, ticketIds: [] },
    { label: "15 - 20 Horas", min: 15, max: 20, count: 0, ticketIds: [] },
    { label: "20 - 24 Horas", min: 20, max: 24, count: 0, ticketIds: [] },
    { label: "0 - 24 Horas", min: 0, max: 24, count: 0, ticketIds: [] },
    { label: "1 - 2 dias", min: 24, max: 48, count: 0, ticketIds: [] },
    { label: "2 - 3 dias", min: 48, max: 72, count: 0, ticketIds: [] },
    { label: "3 - 4 dias", min: 72, max: 96, count: 0, ticketIds: [] },
    { label: "4 - x dias", min: 96, max: -1, count: 0, ticketIds: [] }
  ];

  const ticketsCount = {
    withResponse: {
      individual: { ticketIds: [], count: 0 },
      grupal: { ticketIds: [], count: 0 },
      total: { ticketIds: [], count: 0 }
    },
    withOutResponse: {
      individual: { ticketIds: [], count: 0 },
      grupal: { ticketIds: [], count: 0 },
      total: { ticketIds: [], count: 0 }
    },
    total: {
      individual: { ticketIds: [], count: 0 },
      grupal: { ticketIds: [], count: 0 },
      total: { ticketIds: [], count: 0 }
    }
  };

  let countTicketsWaiting = 0;
  let ticketSindata = [];
  ticketListFind.forEach((ticket: any) => {
    let withResponse = false;
    /**
     * Si no existe dateFirstLastMessageClient quiere decir que el CS comenzo a hablar y el cliente no responde
     * Valido que exista un primer mensaje ultimo del cliente
     * para despues comparar el timestamp del ultimo mensajes del CS
     * Si existe se afirmaria que habiado al menos una respuesta
     * ahorta tocaria validar que el timestamp del CS sea mayor al ultimo mensaje del cliente
     */
    /**
     * Para esta caso es que no hubo timestamp
     */
    if (
      ticket?.dateFirstMessageClient === null &&
      ticket?.dateFistMessageTicket === null &&
      ticket?.dateFirstLastMessageClient === null &&
      ticket?.dateLastMessageCS === null &&
      ticket?.dateFirstMessageCS === null
    ) {
      ticket.timeAuxCreated = convertDateStrToTimestamp(ticket.createdAt);
      ticket.dateFistMessageTicket = ticket.timeAuxCreated;
      ticket.dateFirstLastMessageClient = ticket.dateFistMessageTicket;
    }
    if (
      (ticket?.dateFirstLastMessageClient === null &&
        ticket?.dateFirstMessageCS === null &&
        ticket?.dateFistMessageTicket !== null &&
        ticket?.dateFirstMessageClient !== null &&
        ticket?.dateFistMessageTicket !== ticket?.dateFirstMessageClient) ||
      (ticket?.dateFirstLastMessageClient === null &&
        ticket?.dateLastMessageCS !== null) ||
      (ticket.dateLastMessageCS !== null &&
        ticket.dateFirstLastMessageClient !== null &&
        ticket.dateLastMessageCS > ticket.dateFirstLastMessageClient)
    ) {
      withResponse = true;
    }

    if (withResponse) {
      if (ticket?.isGroup === 1) {
        ticketsCount.withResponse.grupal.count += 1;
        ticketsCount.withResponse.grupal.ticketIds.push(ticket.id);
      } else {
        ticketsCount.withResponse.individual.count += 1;
        ticketsCount.withResponse.individual.ticketIds.push(ticket.id);
      }
    } else if (ticket?.isGroup === 1) {
      ticketsCount.withOutResponse.grupal.count += 1;
      ticketsCount.withOutResponse.grupal.ticketIds.push(ticket.id);
    } else {
      ticketsCount.withOutResponse.individual.count += 1;
      ticketsCount.withOutResponse.individual.ticketIds.push(ticket.id);
    }

    if (!withResponse) {
      let timeStampValidate = null;
      if (ticket.dateFirstLastMessageClient !== null) {
        timeStampValidate = ticket.dateFirstLastMessageClient;
      } else if (ticket.dateFirstMessageClient !== null) {
        timeStampValidate = ticket.dateFirstMessageClient;
      } else if (ticket.dateFistMessageTicket !== null) {
        timeStampValidate = ticket.dateFistMessageTicket;
      }
      let entroo = false;
      if (timeStampValidate !== null) {
        const totalHoursWaiting =
          differenceInSeconds(new Date(), new Date(timeStampValidate * 1000)) /
          3600;
        timesQuintalWaitingResponse.forEach(item => {
          if (
            (item.max === -1 && totalHoursWaiting >= item.min) ||
            (totalHoursWaiting >= item.min && totalHoursWaiting < item.max)
          ) {
            entroo = true;
            item.count += 1;
            item.ticketIds.push({
              id: ticket.id,
              timeSecoundWaiting: totalHoursWaiting * 3600
            });
            countTicketsWaiting += 1;
          }
        });
      }
      if (!entroo) {
        ticketSindata.push(ticket);
      }
    }
  });
  logsTime.push(`foreach-fin: ${Date()}`);
  timesQuintalWaitingResponse.forEach(item => {
    item.ticketIds.sort((a, b) => b.timeSecoundWaiting - a.timeSecoundWaiting);
    item.ticketIds = item.ticketIds.map(itemT => itemT.id);
  });
  ticketsCount.withResponse.total.count =
    ticketsCount.withResponse.individual.count +
    ticketsCount.withResponse.grupal.count;
  ticketsCount.withOutResponse.total.count =
    ticketsCount.withOutResponse.individual.count +
    ticketsCount.withOutResponse.grupal.count;
  ticketsCount.total.individual.count =
    ticketsCount.withResponse.individual.count +
    ticketsCount.withOutResponse.individual.count;
  ticketsCount.total.grupal.count =
    ticketsCount.withResponse.grupal.count +
    ticketsCount.withOutResponse.grupal.count;
  ticketsCount.total.total.count =
    ticketsCount.total.individual.count + ticketsCount.total.grupal.count;
  /**
   * Ahora unire los IDS
   */
  ticketsCount.withResponse.total.ticketIds = [
    ...ticketsCount.withResponse.individual.ticketIds,
    ...ticketsCount.withResponse.grupal.ticketIds
  ];
  ticketsCount.withOutResponse.total.ticketIds = [
    ...ticketsCount.withOutResponse.individual.ticketIds,
    ...ticketsCount.withOutResponse.grupal.ticketIds
  ];
  ticketsCount.total.individual.ticketIds = [
    ...ticketsCount.withResponse.individual.ticketIds,
    ...ticketsCount.withOutResponse.individual.ticketIds
  ];
  ticketsCount.total.grupal.ticketIds = [
    ...ticketsCount.withResponse.grupal.ticketIds,
    ...ticketsCount.withOutResponse.grupal.ticketIds
  ];
  ticketsCount.total.total.ticketIds = [
    ...ticketsCount.total.individual.ticketIds,
    ...ticketsCount.total.grupal.ticketIds
  ];
  logsTime.push(`asignacion-fin: ${Date()}`);
  return res.status(200).json({
    ticketListFind,
    ticketSindata,
    ticketsCount,
    timesQuintalWaitingResponse,
    countTicketsWaiting,
    sql,
    logsTime
  });
};

export const reportHistoryWithDateRange = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const {
    fromDate: fromDateAsString,
    toDate: toDateAsString,
    selectedWhatsappIds: selectedUserIdsAsString,
    selectedCountryIds: selectedCountryIdsAsString,
    selectedQueueIds: selectedQueueIdsAsString
  } = req.query as IndexQuery;

  console.log({ fromDateAsString, toDateAsString });
  const selectedWhatsappIds = JSON.parse(selectedUserIdsAsString) as string[];
  const selectedCountryIds = JSON.parse(selectedCountryIdsAsString) as string[];
  const selectedQueueIds = JSON.parse(selectedQueueIdsAsString) as string[];
  const logsTime = [];
  let sqlWhereAdd = `t.isGroup = 0 AND t.createdAt between '${formatDateToMySQL(
    fromDateAsString
  )}' and '${formatDateToMySQL(toDateAsString)}' `;
  // const sqlWhereAdd = " t.id = 3318 ";

  if (selectedWhatsappIds.length > 0) {
    sqlWhereAdd += ` AND t.whatsappId IN (${selectedWhatsappIds.join(",")}) `;
  }
  if (selectedCountryIds.length > 0) {
    sqlWhereAdd += ` AND ct.countryId IN (${selectedCountryIds.join(",")}) `;
  }
  if (selectedQueueIds.length > 0) {
    if (!selectedQueueIds.includes(null)) {
      sqlWhereAdd += ` AND t.queueId IN (${selectedQueueIds.join(",")}) `;
    } else {
      if (selectedQueueIds.length === 1) {
        sqlWhereAdd += ` AND t.queueId IS NULL`;
      } else {
        sqlWhereAdd += ` AND (t.queueId IN (${selectedQueueIds
          .filter(q => q !== null)
          .join(",")}) OR t.queueId IS NULL)`;
      }
    }
  }
  logsTime.push(`Whatasappnew-inicio: ${Date()}`);
  let whatasappListIDS: any = await Whatsapp.sequelize.query(
    "SELECT * FROM Whatsapps WHERE number IS NOT NULL AND number != '' ",
    { type: QueryTypes.SELECT }
  );
  logsTime.push(`Whatasappnew-fin: ${Date()}`);
  whatasappListIDS = whatasappListIDS
    .map(whatasapp => `'${whatasapp.number}'`)
    .join(",");

  const sql = `SELECT
    t.id,
    t.createdAt,
    t.contactId,
    t.status,
    t.isGroup,
    MIN(
    CASE
        WHEN t.id = m.ticketId
        AND (m.isPrivate IS NULL OR m.isPrivate != '1')
        THEN m.timestamp
        END) as dateFistMessageTicket,
    MAX(CASE
        WHEN t.id = m.ticketId
        THEN m.timestamp
        END) as dateLastMessageticket,
    MIN(CASE
        WHEN t.id = m.ticketId
          AND m.body NOT LIKE CONCAT(UNHEX('E2808E'), '%')
          AND (m.isPrivate IS NULL OR m.isPrivate != '1')
          AND (m.fromMe = 1
          OR c.isCompanyMember = '1'
          OR c.number IN (${whatasappListIDS}) )
        THEN m.timestamp
        END) as dateFirstMessageCS,
  (
      SELECT MIN(m_inner.timestamp)
      FROM Messages m_inner
      LEFT JOIN Contacts c_inner ON m_inner.contactId = c_inner.id
      WHERE
        m_inner.ticketId = t.id
        AND m_inner.body NOT LIKE CONCAT(UNHEX('E2808E'), '%')
        AND (m_inner.fromMe = 1
        OR c_inner.isCompanyMember = '1'
        OR c_inner.number IN (${whatasappListIDS}))
        AND m_inner.timestamp > (
          SELECT MIN(mcs.timestamp)
          FROM Messages mcs
          LEFT JOIN Contacts c_sub ON mcs.contactId = c_sub.id
          WHERE mcs.ticketId = t.id
          AND (mcs.isPrivate IS NULL OR mcs.isPrivate != '1')
          AND mcs.fromMe != 1
          AND (c_sub.isCompanyMember IS NULL OR c_sub.isCompanyMember != '1')
          AND c_sub.number NOT IN (${whatasappListIDS})
        )
    ) as dateSecondMessageCS,
    MAX(CASE
        WHEN t.id = m.ticketId
          AND m.body NOT LIKE CONCAT(UNHEX('E2808E'), '%')
          AND (m.isPrivate IS NULL OR m.isPrivate != 1)
          AND (m.fromMe = 1
          OR c.isCompanyMember = '1'
          OR c.number IN (${whatasappListIDS}))
        THEN m.timestamp
        END) as dateLastMessageCS,
    MIN(CASE
        WHEN t.id = m.ticketId
          AND (m.isPrivate IS NULL OR m.isPrivate != '1')
          AND m.fromMe != 1
          AND (c.isCompanyMember IS NULL OR c.isCompanyMember != '1')
          AND c.number NOT IN (${whatasappListIDS})
        THEN m.timestamp
        END) as dateFirstMessageClient,
      (
      SELECT MIN(m_inner.timestamp)
      FROM Messages m_inner
      LEFT JOIN Contacts c_inner ON m_inner.contactId = c_inner.id
      WHERE
        m_inner.ticketId = t.id
        AND (m_inner.isPrivate IS NULL OR m_inner.isPrivate != '1')
        AND m_inner.fromMe != '1'
        AND (c_inner.isCompanyMember IS NULL OR c_inner.isCompanyMember != '1')
        AND c_inner.number NOT IN (${whatasappListIDS})
        AND m_inner.timestamp >
          (SELECT MAX(mcs.timestamp)
          FROM Messages mcs
          LEFT JOIN Contacts c_sub ON mcs.contactId = c_sub.id
          WHERE mcs.ticketId = t.id
          AND (mcs.body NOT LIKE CONCAT(UNHEX('E2808E'), '%')
                AND (mcs.isPrivate IS NULL OR mcs.isPrivate != '1')
                AND (mcs.fromMe = 1
                OR c_sub.isCompanyMember = '1'
                OR c_sub.number IN (${whatasappListIDS})))
          )
    ) as dateFirstLastMessageClient
  FROM Tickets t
  LEFT JOIN Contacts ct ON t.contactId = ct.id
  LEFT JOIN Messages m ON t.id = m.ticketId
  LEFT JOIN Contacts c ON m.contactId = c.id
  WHERE
  ${sqlWhereAdd}
  GROUP BY t.id `;
  console.log("sql", sql);

  /**
   * Obtengo todos los tickets acortandolos a los filtros de ticken que me pasen
   * # sudo lsof -i :8080
     # sudo kill -9 7877
   */
  const ticketListFind = await Ticket.sequelize.query(sql, {
    type: QueryTypes.SELECT
  });
  logsTime.push(`sql-fin: ${Date()}`);
  /**
   * Los agrupos por para obtener los mensajes del ticket
   */
  const timesQuintalResponse = [
    { label: "0 - 1 Horas", min: 0, max: 1, count: 0, ticketIds: [] },
    { label: "1 - 2 Horas", min: 1, max: 2, count: 0, ticketIds: [] },
    { label: "2 - 3 Horas", min: 2, max: 3, count: 0, ticketIds: [] },
    { label: "3 - 4 Horas", min: 3, max: 4, count: 0, ticketIds: [] },
    { label: "4 - 5 Horas", min: 4, max: 5, count: 0, ticketIds: [] },
    { label: "0 - 5 Horas", min: 0, max: 5, count: 0, ticketIds: [] },
    { label: "5 - 10 Horas", min: 5, max: 10, count: 0, ticketIds: [] },
    { label: "10 - 15 Horas", min: 10, max: 15, count: 0, ticketIds: [] },
    { label: "15 - 20 Horas", min: 15, max: 20, count: 0, ticketIds: [] },
    { label: "20 - 24 Horas", min: 20, max: 24, count: 0, ticketIds: [] },
    { label: "0 - 24 Horas", min: 0, max: 24, count: 0, ticketIds: [] },
    { label: "1 - 2 dias", min: 24, max: 48, count: 0, ticketIds: [] },
    { label: "2 - 3 dias", min: 48, max: 72, count: 0, ticketIds: [] },
    { label: "3 - 4 dias", min: 72, max: 96, count: 0, ticketIds: [] },
    { label: "4 - x dias", min: 96, max: -1, count: 0, ticketIds: [] }
  ];
  const ticketsCreated = { count: 0, ticketIds: [] };
  const ticketsClosed = { count: 0, ticketIds: [] };
  let datesCreatedTickets = [];
  let datesCloseTickets = [];
  let countFirstResponse = 0;
  let totalTimeSecoundsFirstResponse = 0;
  let avgTimeSecoundsFirstResponse = 0;
  let avgTimeSecounsSolution = 0;
  let totalTimeSecounsSolution = 0;

  ticketListFind.forEach((ticket: any) => {
    let timeSecoundFirstResponse = 0;
    ticketsCreated.count += 1;
    ticketsCreated.ticketIds.push(ticket?.id);
    datesCreatedTickets.push(
      formatDate(ticket?.createdAt, "yyyy-MM-dd HH:mm:ss.SSS")
    );
    /**
     * Tiene que existir un mensajes al menos del cliente y del CS
     */
    if (ticket?.dateFirstMessageClient && ticket?.dateFirstMessageCS) {
      /**
       * Si estas dos fechas son iguales quiere decir que el CS comenzo a hablar
       * Si no es porque el CS a respondido
       */
      if (ticket?.dateFistMessageTicket === ticket?.dateFirstMessageCS) {
        /**
         * Valido si hubo un segundo mensajes por parte del CS
         */
        if (ticket?.dateSecondMessageCS) {
          timeSecoundFirstResponse = differenceInSeconds(
            new Date(ticket?.dateSecondMessageCS * 1000),
            new Date(ticket?.dateFirstMessageClient * 1000)
          );
          totalTimeSecoundsFirstResponse += timeSecoundFirstResponse;
          countFirstResponse += 1;
        }
      } else {
        timeSecoundFirstResponse += differenceInSeconds(
          new Date(ticket?.dateFirstMessageCS * 1000),
          new Date(ticket?.dateFirstMessageClient * 1000)
        );
        totalTimeSecoundsFirstResponse += timeSecoundFirstResponse;
        countFirstResponse += 1;
      }
    }
    if (ticket?.status === "closed") {
      ticketsClosed.count += 1;
      ticketsClosed.ticketIds.push(ticket?.id);
      if (ticket?.dateLastMessageticket) {
        datesCloseTickets.push(
          format(
            new Date(ticket.dateLastMessageticket * 1000),
            "yyyy-MM-dd HH:mm:ss.SSS"
          )
        );
      } else {
        console.log("no hay data");
      }
      if (!!ticket?.dateFistMessageTicket && !!ticket?.dateLastMessageticket) {
        const totalTimeResolution = differenceInSeconds(
          new Date(ticket?.dateLastMessageticket * 1000),
          new Date(ticket?.dateFistMessageTicket * 1000)
        );
        totalTimeSecounsSolution += totalTimeResolution;
        const totalTimeHoursResolution = totalTimeResolution / 3600;
        timesQuintalResponse.forEach(item => {
          if (
            (item.max === -1 && totalTimeHoursResolution >= item.min) ||
            (totalTimeHoursResolution >= item.min &&
              totalTimeHoursResolution < item.max)
          ) {
            item.count += 1;
            item.ticketIds.push(ticket.id);
          }
        });
      }
    }
  });
  logsTime.push(`foreach-fin: ${Date()}`);
  /**
   *Valido si hay tickets con primera respuesta
   */
  if (countFirstResponse > 0 && totalTimeSecoundsFirstResponse > 0) {
    avgTimeSecoundsFirstResponse =
      totalTimeSecoundsFirstResponse / countFirstResponse;
  }
  /**
   *Valido si hay tickets cerrados
   */
  if (datesCloseTickets.length > 0 && totalTimeSecounsSolution > 0) {
    avgTimeSecounsSolution = totalTimeSecounsSolution / ticketsClosed.count;
  }

  datesCreatedTickets = groupDateWithRange(
    fromDateAsString.split("T")[0],
    toDateAsString.split("T")[0],
    datesCreatedTickets
  );
  datesCloseTickets = groupDateWithRange(
    fromDateAsString.split("T")[0],
    toDateAsString.split("T")[0],
    datesCloseTickets
  );

  logsTime.push(`asignacion-fin: ${Date()}`);
  return res.status(200).json({
    ticketListFind,
    datesCreatedTickets,
    datesCloseTickets,
    totalTimeSecoundsFirstResponse,
    countFirstResponse,
    avgTimeSecoundsFirstResponse,
    totalTimeSecounsSolution,
    avgTimeSecounsSolution,
    timesQuintalResponse,
    ticketsCreated,
    ticketsClosed,
    sql,
    logsTime
  });
};

export const reportToExcel = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const {
    fromDate: fromDateAsString,
    toDate: toDateAsString
    // selectedWhatsappIds: selectedUserIdsAsString,
    // selectedCountryIds: selectedCountryIdsAsString
  } = req.query as IndexQuery;

  // const selectedWhatsappIds = JSON.parse(selectedUserIdsAsString) as string[];
  // const selectedCountryIds = JSON.parse(selectedCountryIdsAsString) as string[];
  const logsTime = [];
  let sqlWhereAdd = `t.status != 'pending' and t.createdAt between '${formatDateToMySQL(
    fromDateAsString
  )}' and '${formatDateToMySQL(toDateAsString)}' `;
  // const sqlWhereAdd = " t.id = 3318 ";

  // if (selectedWhatsappIds.length > 0) {
  //   sqlWhereAdd += ` AND t.whatsappId IN (${selectedWhatsappIds.join(",")}) `;
  // }
  // if (selectedCountryIds.length > 0) {
  //   sqlWhereAdd += ` AND ct.countryId IN (${selectedCountryIds.join(",")}) `;
  // }
  logsTime.push(`Whatasappnew-inicio: ${Date()}`);
  let whatasappListIDS: any[] = await Whatsapp.sequelize.query(
    "SELECT * FROM Whatsapps WHERE number IS NOT NULL AND number != '' ",
    { type: QueryTypes.SELECT }
  );
  logsTime.push(`Whatasappnew-fin: ${Date()}`);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  whatasappListIDS = whatasappListIDS.map(whatasapp => `'${whatasapp.number}'`);

  const sql = `SELECT
    t.id as tid,
    t.isGroup as tisGroup,
    t.createdAt as tcreatedAt,
    que.name as queuename,
    t.status as tstatus,
    m.id as mid,
    m.timestamp as mtimestamp,
    m.createdAt as mcreatedAt,
    m.isPrivate as misPrivate,
    m.fromMe as mfromMe,
    m.body as mbody,
    c.isCompanyMember as misCompanyMember,
    c.number as cmnumber,
    u.id as uid,
    u.name as uname,
    ct.id as ctid,
    ct.name as ctname,
    ct.number as ctnumber,
    w.id as wid,
    w.name as wname,
    ctc.name as ctcname
  FROM Tickets t
  LEFT JOIN Users u ON t.userId = u.id
  LEFT JOIN Whatsapps w ON t.whatsappId = w.id
  LEFT JOIN Contacts ct ON t.contactId = ct.id
  LEFT JOIN Countries ctc ON ct.countryId = ctc.id
  LEFT JOIN Messages m ON t.id = m.ticketId
  LEFT JOIN Contacts c ON m.contactId = c.id
  LEFT JOIN Queues que ON t.queueId = que.id
  WHERE
  ${sqlWhereAdd}`;
  console.log("sql", sql);
  logsTime.push(`sql-inicio: ${Date()}`);
  const ticketListFinal = [];
  /**
   * Obtengo todos los tickets acortandolos a los filtros de ticken que me pasen
   * # sudo lsof -i :8080
     # sudo kill -9 7877
   */
  const ticketListFind = await Ticket.sequelize.query(sql, {
    type: QueryTypes.SELECT
  });
  logsTime.push(`sql-fin: ${Date()}`);
  /**
   * Separar los tickets en pendientes o abiertos y cerrados
   * porque va hacer diferente calculos
   * Agrupar en ram por ticketID
   */
  const timesQuintalResponse = [
    { label: "0 - 1 Horas", min: 0, max: 1, count: 0, ticketIds: [] },
    { label: "1 - 2 Horas", min: 1, max: 2, count: 0, ticketIds: [] },
    { label: "2 - 3 Horas", min: 2, max: 3, count: 0, ticketIds: [] },
    { label: "3 - 4 Horas", min: 3, max: 4, count: 0, ticketIds: [] },
    { label: "4 - 5 Horas", min: 4, max: 5, count: 0, ticketIds: [] },
    { label: "0 - 5 Horas", min: 0, max: 5, count: 0, ticketIds: [] },
    { label: "5 - 10 Horas", min: 5, max: 10, count: 0, ticketIds: [] },
    { label: "10 - 15 Horas", min: 10, max: 15, count: 0, ticketIds: [] },
    { label: "15 - 20 Horas", min: 15, max: 20, count: 0, ticketIds: [] },
    { label: "20 - 24 Horas", min: 20, max: 24, count: 0, ticketIds: [] },
    { label: "0 - 24 Horas", min: 0, max: 24, count: 0, ticketIds: [] },
    { label: "1 - 2 dias", min: 24, max: 48, count: 0, ticketIds: [] },
    { label: "2 - 3 dias", min: 48, max: 72, count: 0, ticketIds: [] },
    { label: "3 - 4 dias", min: 72, max: 96, count: 0, ticketIds: [] },
    { label: "4 - x dias", min: 96, max: -1, count: 0, ticketIds: [] }
  ];

  const timesQuintalWaitingResponse = [
    { label: "0 - 1 Horas", min: 0, max: 1, count: 0, ticketIds: [] },
    { label: "1 - 2 Horas", min: 1, max: 2, count: 0, ticketIds: [] },
    { label: "2 - 3 Horas", min: 2, max: 3, count: 0, ticketIds: [] },
    { label: "3 - 4 Horas", min: 3, max: 4, count: 0, ticketIds: [] },
    { label: "4 - 5 Horas", min: 4, max: 5, count: 0, ticketIds: [] },
    { label: "0 - 5 Horas", min: 0, max: 5, count: 0, ticketIds: [] },
    { label: "5 - 10 Horas", min: 5, max: 10, count: 0, ticketIds: [] },
    { label: "10 - 15 Horas", min: 10, max: 15, count: 0, ticketIds: [] },
    { label: "15 - 20 Horas", min: 15, max: 20, count: 0, ticketIds: [] },
    { label: "20 - 24 Horas", min: 20, max: 24, count: 0, ticketIds: [] },
    { label: "0 - 24 Horas", min: 0, max: 24, count: 0, ticketIds: [] },
    { label: "1 - 2 dias", min: 24, max: 48, count: 0, ticketIds: [] },
    { label: "2 - 3 dias", min: 48, max: 72, count: 0, ticketIds: [] },
    { label: "3 - 4 dias", min: 72, max: 96, count: 0, ticketIds: [] },
    { label: "4 - x dias", min: 96, max: -1, count: 0, ticketIds: [] }
  ];

  let ticketsClosed: any = ticketListFind.filter(
    (ticket: any) => ticket?.tstatus === "closed"
  );
  let ticketsPendingOpen: any = ticketListFind.filter(
    (ticket: any) => ticket?.tstatus !== "closed"
  );
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ticketsClosed = ticketsClosed.reduce((result, currentValue: any) => {
    if (!result[currentValue?.tid]) {
      result[currentValue.tid] = [];
    }
    result[currentValue.tid].push(currentValue);
    return result;
  }, {});
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ticketsPendingOpen = ticketsPendingOpen.reduce(
    (result, currentValue: any) => {
      if (!result[currentValue?.tid]) {
        result[currentValue.tid] = [];
      }
      result[currentValue.tid].push(currentValue);
      return result;
    },
    {}
  );
  // Recorrer el objeto de tickets cerrados
  // eslint-disable-next-line no-restricted-syntax, guard-for-in
  for (const ticketId in ticketsClosed) {
    const times = processMessageTicketClosed(
      ticketsClosed[ticketId],
      whatasappListIDS
    );
    if (times.resolution !== null) {
      const resolutionHours = times.resolution / 3600;
      times.resolution = secondsToDhms(times.resolution);
      timesQuintalResponse.forEach(quintal => {
        if (
          times.quintalHours === null &&
          ((quintal.max === -1 && resolutionHours >= quintal.min) ||
            (resolutionHours >= quintal.min && resolutionHours < quintal.max))
        ) {
          times.quintalHours = quintal.label;
        }
      });
    }
    ticketListFinal.push({
      tid: ticketsClosed[ticketId][0].tid,
      uname: ticketsClosed[ticketId][0].uname,
      ctname: ticketsClosed[ticketId][0].ctname,
      wname: ticketsClosed[ticketId][0].wname,
      tstatus: ticketsClosed[ticketId][0].tstatus,
      tisGroup: ticketsClosed[ticketId][0].tisGroup,
      ctcname: ticketsClosed[ticketId][0].ctcname,
      ctnumber: ticketsClosed[ticketId][0].ctnumber,
      tcreatedAt: ticketsClosed[ticketId][0].tcreatedAt,
      queuename: ticketsClosed[ticketId][0].queuename,
      ...times
    });
  }

  // eslint-disable-next-line no-restricted-syntax, guard-for-in
  for (const ticketId in ticketsPendingOpen) {
    const times = processMessageTicketPendingOrOpen(
      ticketsPendingOpen[ticketId],
      whatasappListIDS
    );
    if (times.waiting !== null) {
      const waitingHours = times.waiting / 3600;
      times.waiting = secondsToDhms(times.waiting);
      timesQuintalWaitingResponse.forEach(quintal => {
        if (
          times.quintalHours === null &&
          ((quintal.max === -1 && waitingHours >= quintal.min) ||
            (waitingHours >= quintal.min && waitingHours < quintal.max))
        ) {
          times.quintalHours = quintal.label;
        }
      });
    }
    ticketListFinal.push({
      tid: ticketsPendingOpen[ticketId][0].tid,
      uname: ticketsPendingOpen[ticketId][0].uname,
      ctname: ticketsPendingOpen[ticketId][0].ctname,
      wname: ticketsPendingOpen[ticketId][0].wname,
      tstatus: ticketsPendingOpen[ticketId][0].tstatus,
      tisGroup: ticketsPendingOpen[ticketId][0].tisGroup,
      ctcname: ticketsPendingOpen[ticketId][0].ctcname,
      ctnumber: ticketsPendingOpen[ticketId][0].ctnumber,
      tcreatedAt: ticketsPendingOpen[ticketId][0].tcreatedAt,
      queuename: ticketsPendingOpen[ticketId][0].queuename,
      ...times
    });
  }

  if (ticketListFinal.length > 0) {
    console.log(
      "-----------:",
      `
      SELECT * FROM TicketCategories tc LEFT JOIN Categories c ON c.id = tc.categoryId WHERE tc.ticketId in (${ticketListFinal
        .map(ticket => ticket.tid)
        .join(",")}) ORDER BY tc.updatedAt DESC
      `
    );

    let ticketListFinalCategories: any[] = await Ticket.sequelize.query(
      `
      SELECT * FROM TicketCategories tc LEFT JOIN Categories c ON c.id = tc.categoryId WHERE tc.ticketId in (${ticketListFinal
        .map(ticket => ticket.tid)
        .join(",")}) ORDER BY tc.updatedAt DESC
      `,
      {
        type: QueryTypes.SELECT
      }
    );

    ticketListFinalCategories = ticketListFinalCategories.reduce(
      (result, currentValue: any) => {
        const currentValueInResult = result.find(
          ticket => ticket.ticketId === currentValue.ticketId
        );
        if (!currentValueInResult) {
          result.push(currentValue);
        }
        return result;
      },
      []
    );

    for (const ticketCategory of ticketListFinalCategories) {
      if (ticketListFinal.find(t => t.tid === ticketCategory.ticketId)) {
        ticketListFinal.find(
          t => t.tid === ticketCategory.ticketId
        ).tcategoryname = ticketCategory.name;
      }
    }
  }

  logsTime.push(`asignacion-fin: ${Date()}`);
  return res.status(200).json({
    // ticketListFind,
    ticketListFinal,
    sql,
    logsTime
  });
};

export const reportToExcelForIA = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const {
    fromDate: fromDateAsString,
    toDate: toDateAsString,
    selectedQueueIds: selectedQueueIdsAsString
  } = req.query as IndexQuery;

  const selectedQueueIds = JSON.parse(selectedQueueIdsAsString) as string[];

  const logsTime = [];
  let sqlWhereAdd = `t.status != 'pending' AND t.isGroup = 0 AND t.createdAt between '${formatDateToMySQL(
    fromDateAsString
  )}' and '${formatDateToMySQL(toDateAsString)}' `;

  if (selectedQueueIds.length > 0) {
    if (!selectedQueueIds.includes(null)) {
      sqlWhereAdd += ` AND t.queueId IN (${selectedQueueIds.join(",")}) `;
    } else {
      if (selectedQueueIds.length === 1) {
        sqlWhereAdd += ` AND t.queueId IS NULL`;
      } else {
        sqlWhereAdd += ` AND (t.queueId IN (${selectedQueueIds
          .filter(q => q !== null)
          .join(",")}) OR t.queueId IS NULL)`;
      }
    }
  }

  // 5076 con grupos

  logsTime.push(`Whatasappnew-inicio: ${Date()}`);
  let whatasappListIDS: any[] = await Whatsapp.sequelize.query(
    "SELECT * FROM Whatsapps WHERE number IS NOT NULL AND number != '' ",
    { type: QueryTypes.SELECT }
  );
  logsTime.push(`Whatasappnew-fin: ${Date()}`);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  whatasappListIDS = whatasappListIDS.map(whatasapp => `'${whatasapp.number}'`);

  const sql = `SELECT
    t.id as tid,
    t.isGroup as tisGroup,
    t.createdAt as tcreatedAt,
    que.name as queuename,
    t.status as tstatus,
    m.id as mid,
    m.timestamp as mtimestamp,
    m.createdAt as mcreatedAt,
    m.isPrivate as misPrivate,
    m.fromMe as mfromMe,
    m.body as mbody,
    m.mediaType as mmediaType,
    c.isCompanyMember as misCompanyMember,
    c.number as cmnumber,
    u.id as uid,
    u.name as uname,
    ct.id as ctid,
    ct.name as ctname,
    ct.number as ctnumber,
    w.id as wid,
    w.name as wname,
    ctc.name as ctcname
  FROM Tickets t
  LEFT JOIN Users u ON t.userId = u.id
  LEFT JOIN Whatsapps w ON t.whatsappId = w.id
  LEFT JOIN Contacts ct ON t.contactId = ct.id
  LEFT JOIN Countries ctc ON ct.countryId = ctc.id
  LEFT JOIN Messages m ON t.id = m.ticketId
  LEFT JOIN Contacts c ON m.contactId = c.id
  LEFT JOIN Queues que ON t.queueId = que.id
  WHERE
  ${sqlWhereAdd}`;
  console.log("sql", sql);
  logsTime.push(`sql-inicio: ${Date()}`);
  const ticketListFinal = [];

  const ticketListFind = await Ticket.sequelize.query(sql, {
    type: QueryTypes.SELECT
  });
  logsTime.push(`sql-fin: ${Date()}`);

  let ticketsClosed: any = ticketListFind.filter(
    (ticket: any) => ticket?.tstatus === "closed"
  );
  let ticketsPendingOpen: any = ticketListFind.filter(
    (ticket: any) => ticket?.tstatus !== "closed"
  );
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ticketsClosed = ticketsClosed.reduce((result, currentValue: any) => {
    if (!result[currentValue?.tid]) {
      result[currentValue.tid] = [];
    }
    result[currentValue.tid].push(currentValue);
    return result;
  }, {});

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ticketsPendingOpen = ticketsPendingOpen.reduce(
    (result, currentValue: any) => {
      if (!result[currentValue?.tid]) {
        result[currentValue.tid] = [];
      }
      result[currentValue.tid].push(currentValue);
      return result;
    },
    {}
  );
  // Recorrer el objeto de tickets cerrados
  // eslint-disable-next-line no-restricted-syntax, guard-for-in
  for (const ticketId in ticketsClosed) {
    const IATrainingData = processTicketMessagesForReturnIATrainingData(
      ticketsClosed[ticketId],
      whatasappListIDS
    );

    ticketListFinal.push({
      tid: ticketsClosed[ticketId][0].tid,
      uname: ticketsClosed[ticketId][0].uname,
      ctname: ticketsClosed[ticketId][0].ctname,
      wname: ticketsClosed[ticketId][0].wname,
      tstatus: ticketsClosed[ticketId][0].tstatus,
      tisGroup: ticketsClosed[ticketId][0].tisGroup,
      ctcname: ticketsClosed[ticketId][0].ctcname,
      ctnumber: ticketsClosed[ticketId][0].ctnumber,
      tcreatedAt: ticketsClosed[ticketId][0].tcreatedAt,
      queuename: ticketsClosed[ticketId][0].queuename,
      IATrainingData
    });
  }

  // eslint-disable-next-line no-restricted-syntax, guard-for-in
  for (const ticketId in ticketsPendingOpen) {
    const IATrainingData = processTicketMessagesForReturnIATrainingData(
      ticketsPendingOpen[ticketId],
      whatasappListIDS
    );

    ticketListFinal.push({
      tid: ticketsPendingOpen[ticketId][0].tid,
      uname: ticketsPendingOpen[ticketId][0].uname,
      ctname: ticketsPendingOpen[ticketId][0].ctname,
      wname: ticketsPendingOpen[ticketId][0].wname,
      tstatus: ticketsPendingOpen[ticketId][0].tstatus,
      tisGroup: ticketsPendingOpen[ticketId][0].tisGroup,
      ctcname: ticketsPendingOpen[ticketId][0].ctcname,
      ctnumber: ticketsPendingOpen[ticketId][0].ctnumber,
      tcreatedAt: ticketsPendingOpen[ticketId][0].tcreatedAt,
      queuename: ticketsPendingOpen[ticketId][0].queuename,
      IATrainingData
    });
  }

  if (ticketListFinal.length > 0) {
    // console.log(
    //   "-----------:",
    //   `
    //   SELECT * FROM TicketCategories tc LEFT JOIN Categories c ON c.id = tc.categoryId WHERE tc.ticketId in (${ticketListFinal
    //     .map(ticket => ticket.tid)
    //     .join(",")}) ORDER BY tc.updatedAt DESC
    //   `
    // );

    let ticketListFinalCategories: any[] = await Ticket.sequelize.query(
      `
      SELECT * FROM TicketCategories tc LEFT JOIN Categories c ON c.id = tc.categoryId WHERE tc.ticketId in (${ticketListFinal
        .map(ticket => ticket.tid)
        .join(",")}) ORDER BY tc.updatedAt DESC
      `,
      {
        type: QueryTypes.SELECT
      }
    );

    ticketListFinalCategories = ticketListFinalCategories.reduce(
      (result, currentValue: any) => {
        const currentValueInResult = result.find(
          ticket => ticket.ticketId === currentValue.ticketId
        );
        if (!currentValueInResult) {
          result.push(currentValue);
        }
        return result;
      },
      []
    );

    for (const ticketCategory of ticketListFinalCategories) {
      if (ticketListFinal.find(t => t.tid === ticketCategory.ticketId)) {
        ticketListFinal.find(
          t => t.tid === ticketCategory.ticketId
        ).tcategoryname = ticketCategory.name;
      }
    }
  }

  logsTime.push(`asignacion-fin: ${Date()}`);
  return res.status(200).json({
    ticketListFinal,
    sql,
    logsTime
  });
};

export const reportToUsers = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const {
    fromDate: fromDateAsString,
    toDate: toDateAsString,
    selectedWhatsappIds: selectedUserIdsAsString,
    selectedCountryIds: selectedCountryIdsAsString,
    selectedQueueIds: selectedQueueIdsAsString
  } = req.query as IndexQuery;

  const selectedWhatsappIds = JSON.parse(selectedUserIdsAsString) as string[];
  const selectedCountryIds = JSON.parse(selectedCountryIdsAsString) as string[];
  const selectedQueueIds = JSON.parse(selectedQueueIdsAsString) as string[];
  const logsTime = [];
  let sqlWhereAdd = `t.status != 'pending' and t.isGroup = 0 and t.createdAt between '${formatDateToMySQL(
    fromDateAsString
  )}' and '${formatDateToMySQL(toDateAsString)}' `;
  // const sqlWhereAdd = " t.id = 3318 ";

  if (selectedWhatsappIds.length > 0) {
    sqlWhereAdd += ` AND t.whatsappId IN (${selectedWhatsappIds.join(",")}) `;
  }
  if (selectedCountryIds.length > 0) {
    sqlWhereAdd += ` AND ct.countryId IN (${selectedCountryIds.join(",")}) `;
  }
  if (selectedQueueIds.length > 0) {
    if (!selectedQueueIds.includes(null)) {
      sqlWhereAdd += ` AND t.queueId IN (${selectedQueueIds.join(",")}) `;
    } else {
      if (selectedQueueIds.length === 1) {
        sqlWhereAdd += ` AND t.queueId IS NULL`;
      } else {
        sqlWhereAdd += ` AND (t.queueId IN (${selectedQueueIds
          .filter(q => q !== null)
          .join(",")}) OR t.queueId IS NULL)`;
      }
    }
  }
  logsTime.push(`Whatasappnew-inicio: ${Date()}`);
  let whatasappListIDS: any[] = await Whatsapp.sequelize.query(
    "SELECT * FROM Whatsapps WHERE number IS NOT NULL AND number != '' ",
    { type: QueryTypes.SELECT }
  );
  logsTime.push(`Whatasappnew-fin: ${Date()}`);
  const usersListAll = {};
  let usersListFind: any[] = await User.sequelize.query("SELECT * FROM Users", {
    type: QueryTypes.SELECT
  });
  usersListFind = usersListFind.reduce((result, currentValue: any) => {
    currentValue.ticketCount = 0;
    currentValue.ticketClosedCount = 0;
    currentValue.ticketOpenCount = 0;
    currentValue.timeWaitingCount = 0;
    currentValue.timeWaitingSecounds = 0;
    if (!result[currentValue?.id]) {
      result[currentValue.id] = [];
    }
    result[currentValue.id].push(currentValue);
    return result;
  }, {});
  // eslint-disable-next-line no-restricted-syntax, guard-for-in
  for (const userId in usersListFind) {
    usersListAll[userId] = {
      ticketCount: 0,
      ticketClosedCount: 0,
      ticketOpenCount: 0,
      timeWaitingCount: 0,
      timeWaitingSecounds: 0,
      name: usersListFind[userId][0].name
    };
  }
  logsTime.push(`usersfind-fin: ${Date()}`);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  whatasappListIDS = whatasappListIDS.map(whatasapp => `'${whatasapp.number}'`);

  const sql = `SELECT
    t.id as tid,
    t.userId as tuserId,
    t.isGroup as tisGroup,
    t.createdAt as tcreatedAt,
    que.name as queuename,
    t.status as tstatus,
    m.id as mid,
    m.timestamp as mtimestamp,
    m.createdAt as mcreatedAt,
    m.isPrivate as misPrivate,
    m.fromMe as mfromMe,
    m.body as mbody,
    c.isCompanyMember as misCompanyMember,
    c.number as cmnumber,
    u.id as uid,
    u.name as uname,
    ct.id as ctid,
    ct.name as ctname,
    ct.number as ctnumber,
    w.id as wid,
    w.name as wname,
    ctc.name as ctcname
  FROM Tickets t
  LEFT JOIN Users u ON t.userId = u.id
  LEFT JOIN Whatsapps w ON t.whatsappId = w.id
  LEFT JOIN Contacts ct ON t.contactId = ct.id
  LEFT JOIN Countries ctc ON ct.countryId = ctc.id
  LEFT JOIN Messages m ON t.id = m.ticketId
  LEFT JOIN Contacts c ON m.contactId = c.id
  LEFT JOIN Queues que ON t.queueId = que.id
  WHERE
  ${sqlWhereAdd}`;
  console.log("sql", sql);
  logsTime.push(`sql-inicio: ${Date()}`);
  /**
   * Obtengo todos los tickets acortandolos a los filtros de ticken que me pasen
   * # sudo lsof -i :8080
     # sudo kill -9 7877
   */
  const ticketListFind = await Ticket.sequelize.query(sql, {
    type: QueryTypes.SELECT
  });
  logsTime.push(`sql-fin: ${Date()}`);
  /**
   * Separar los tickets en pendientes o abiertos y cerrados
   * porque va hacer diferente calculos
   * Agrupar en ram por ticketID
   */
  const timesQuintalResponse = [
    { label: "0 - 1 Horas", min: 0, max: 1, count: 0, ticketIds: [] },
    { label: "1 - 2 Horas", min: 1, max: 2, count: 0, ticketIds: [] },
    { label: "2 - 3 Horas", min: 2, max: 3, count: 0, ticketIds: [] },
    { label: "3 - 4 Horas", min: 3, max: 4, count: 0, ticketIds: [] },
    { label: "4 - 5 Horas", min: 4, max: 5, count: 0, ticketIds: [] },
    { label: "0 - 5 Horas", min: 0, max: 5, count: 0, ticketIds: [] },
    { label: "5 - 10 Horas", min: 5, max: 10, count: 0, ticketIds: [] },
    { label: "10 - 15 Horas", min: 10, max: 15, count: 0, ticketIds: [] },
    { label: "15 - 20 Horas", min: 15, max: 20, count: 0, ticketIds: [] },
    { label: "20 - 24 Horas", min: 20, max: 24, count: 0, ticketIds: [] },
    { label: "0 - 24 Horas", min: 0, max: 24, count: 0, ticketIds: [] },
    { label: "1 - 2 dias", min: 24, max: 48, count: 0, ticketIds: [] },
    { label: "2 - 3 dias", min: 48, max: 72, count: 0, ticketIds: [] },
    { label: "3 - 4 dias", min: 72, max: 96, count: 0, ticketIds: [] },
    { label: "4 - x dias", min: 96, max: -1, count: 0, ticketIds: [] }
  ];

  const timesQuintalWaitingResponse = [
    { label: "0 - 1 Horas", min: 0, max: 1, count: 0, ticketIds: [] },
    { label: "1 - 2 Horas", min: 1, max: 2, count: 0, ticketIds: [] },
    { label: "2 - 3 Horas", min: 2, max: 3, count: 0, ticketIds: [] },
    { label: "3 - 4 Horas", min: 3, max: 4, count: 0, ticketIds: [] },
    { label: "4 - 5 Horas", min: 4, max: 5, count: 0, ticketIds: [] },
    { label: "0 - 5 Horas", min: 0, max: 5, count: 0, ticketIds: [] },
    { label: "5 - 10 Horas", min: 5, max: 10, count: 0, ticketIds: [] },
    { label: "10 - 15 Horas", min: 10, max: 15, count: 0, ticketIds: [] },
    { label: "15 - 20 Horas", min: 15, max: 20, count: 0, ticketIds: [] },
    { label: "20 - 24 Horas", min: 20, max: 24, count: 0, ticketIds: [] },
    { label: "0 - 24 Horas", min: 0, max: 24, count: 0, ticketIds: [] },
    { label: "1 - 2 dias", min: 24, max: 48, count: 0, ticketIds: [] },
    { label: "2 - 3 dias", min: 48, max: 72, count: 0, ticketIds: [] },
    { label: "3 - 4 dias", min: 72, max: 96, count: 0, ticketIds: [] },
    { label: "4 - x dias", min: 96, max: -1, count: 0, ticketIds: [] }
  ];

  let ticketsClosed: any = ticketListFind.filter(
    (ticket: any) => ticket?.tstatus === "closed"
  );
  let ticketsPendingOpen: any = ticketListFind.filter(
    (ticket: any) => ticket?.tstatus !== "closed"
  );
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ticketsClosed = ticketsClosed.reduce((result, currentValue: any) => {
    if (!result[currentValue?.tid]) {
      result[currentValue.tid] = [];
    }
    result[currentValue.tid].push(currentValue);
    return result;
  }, {});
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ticketsPendingOpen = ticketsPendingOpen.reduce(
    (result, currentValue: any) => {
      if (!result[currentValue?.tid]) {
        result[currentValue.tid] = [];
      }
      result[currentValue.tid].push(currentValue);
      return result;
    },
    {}
  );
  // Recorrer el objeto de tickets cerrados
  // eslint-disable-next-line no-restricted-syntax, guard-for-in
  for (const ticketId in ticketsClosed) {
    const times = processMessageTicketClosed(
      ticketsClosed[ticketId],
      whatasappListIDS
    );
    if (times.resolution !== null) {
      const resolutionHours = times.resolution / 3600;
      times.resolution = secondsToDhms(times.resolution);
      timesQuintalResponse.forEach(quintal => {
        if (
          times.quintalHours === null &&
          ((quintal.max === -1 && resolutionHours >= quintal.min) ||
            (resolutionHours >= quintal.min && resolutionHours < quintal.max))
        ) {
          times.quintalHours = quintal.label;
        }
      });
    }
    // ticketListFinal.push({
    //   tid: ticketsClosed[ticketId][0].tid,
    //   uname: ticketsClosed[ticketId][0].uname,
    //   ctname: ticketsClosed[ticketId][0].ctname,
    //   wname: ticketsClosed[ticketId][0].wname,
    //   tstatus: ticketsClosed[ticketId][0].tstatus,
    //   tisGroup: ticketsClosed[ticketId][0].tisGroup,
    //   ctcname: ticketsClosed[ticketId][0].ctcname,
    //   ctnumber: ticketsClosed[ticketId][0].ctnumber,
    //   tcreatedAt: ticketsClosed[ticketId][0].tcreatedAt,
    //   queuename: ticketsClosed[ticketId][0].queuename,
    //   ...times
    // });
    const ticketUserID = ticketsClosed[ticketId][0].tuserId;
    if (ticketUserID !== null && usersListAll?.[ticketUserID] !== null) {
      usersListAll[ticketUserID].ticketCount += 1;
      usersListAll[ticketUserID].ticketClosedCount += 1;
    }
  }

  // eslint-disable-next-line no-restricted-syntax, guard-for-in
  for (const ticketId in ticketsPendingOpen) {
    let timeWaitingCount = 0;
    let timeWaitingSecounds = 0;
    const times = processMessageTicketPendingOrOpen(
      ticketsPendingOpen[ticketId],
      whatasappListIDS
    );
    if (times.waiting !== null) {
      timeWaitingCount = 1;
      timeWaitingSecounds = times.waiting;
      const waitingHours = times.waiting / 3600;
      times.waiting = secondsToDhms(times.waiting);
      timesQuintalWaitingResponse.forEach(quintal => {
        if (
          times.quintalHours === null &&
          ((quintal.max === -1 && waitingHours >= quintal.min) ||
            (waitingHours >= quintal.min && waitingHours < quintal.max))
        ) {
          times.quintalHours = quintal.label;
        }
      });
    } else {
      // if (ticketsPendingOpen[ticketId][0].tuserId === 6) {
      // if (ticketId === "549") {
      // console.log(
      //   "userId:",
      //   ticketsPendingOpen[ticketId][0].tuserId,
      //   "este ticket NO esta esperando: ",
      //   ticketId,
      //   "tiempos:",
      //   times
      // );
      // console.log(
      //   "lo que se mando:",
      //   ticketsPendingOpen[ticketId],
      //   whatasappListIDS
      // );
      // }
    }
    // ticketListFinal.push({
    //   tid: ticketsPendingOpen[ticketId][0].tid,
    //   uname: ticketsPendingOpen[ticketId][0].uname,
    //   ctname: ticketsPendingOpen[ticketId][0].ctname,
    //   wname: ticketsPendingOpen[ticketId][0].wname,
    //   tstatus: ticketsPendingOpen[ticketId][0].tstatus,
    //   tisGroup: ticketsPendingOpen[ticketId][0].tisGroup,
    //   ctcname: ticketsPendingOpen[ticketId][0].ctcname,
    //   ctnumber: ticketsPendingOpen[ticketId][0].ctnumber,
    //   tcreatedAt: ticketsPendingOpen[ticketId][0].tcreatedAt,
    //   queuename: ticketsPendingOpen[ticketId][0].queuename,
    //   ...times
    // });
    const ticketUserID = ticketsPendingOpen[ticketId][0].tuserId;
    if (ticketUserID !== null && usersListAll?.[ticketUserID] !== null) {
      usersListAll[ticketUserID].timeWaitingCount += timeWaitingCount;
      usersListAll[ticketUserID].timeWaitingSecounds += timeWaitingSecounds;
      usersListAll[ticketUserID].ticketCount += 1;
      usersListAll[ticketUserID].ticketOpenCount += 1;
    }
  }
  logsTime.push(`asignacion-fin: ${Date()}`);
  return res.status(200).json({
    usersListAll,
    // usersListFind,
    sql,
    logsTime
  });
};
