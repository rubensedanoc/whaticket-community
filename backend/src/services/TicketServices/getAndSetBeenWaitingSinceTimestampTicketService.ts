import { Op, QueryTypes } from "sequelize";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { convertDateStrToTimestamp } from "../../utils/util";

const getAndSetBeenWaitingSinceTimestampTicketService = async (
  ticketOrTickets: Ticket | Ticket[]
): Promise<Ticket | Ticket[]> => {
  const tickets = Array.isArray(ticketOrTickets)
    ? ticketOrTickets
    : [ticketOrTickets];

  const ticketsIds = tickets.map(ticket => ticket.id);

  const allWhatasappIds: any = (
    await Whatsapp.findAll({
      attributes: ["id", "number"],
      where: {
        number: {
          [Op.not]: null,
          [Op.ne]: ""
        }
      }
    })
  )
    .map(wpp => `'${wpp.number}'`)
    .join(",");

  const sql = `SELECT
                t.id,
                t.createdAt,
                t.contactId,
                t.status,
                t.isGroup,
                t.whatsappId,
                MIN( CASE
                      WHEN t.id = m.ticketId
                        AND (m.isPrivate IS NULL OR m.isPrivate != '1')
                      THEN m.timestamp
                     END
                ) as fistTicketMessageTimestamp,
                MIN( CASE
                      WHEN t.id = m.ticketId
                        AND (m.isPrivate IS NULL OR m.isPrivate != '1')
                        AND m.fromMe != 1
                        AND (c.isCompanyMember IS NULL OR c.isCompanyMember != '1')
                        AND c.number NOT IN (${allWhatasappIds})
                      THEN m.timestamp
                     END
                ) as firstClientMessageTimestamp,
                ( SELECT MIN( m_inner.timestamp )
                  FROM Messages m_inner
                  LEFT JOIN Contacts c_inner ON m_inner.contactId = c_inner.id
                  WHERE m_inner.ticketId = t.id
                    AND (m_inner.isPrivate IS NULL OR m_inner.isPrivate != '1')
                    AND m_inner.fromMe != '1'
                    AND (c_inner.isCompanyMember IS NULL OR c_inner.isCompanyMember != '1')
                    AND c_inner.number NOT IN (${allWhatasappIds})
                    AND m_inner.timestamp >
                      ( SELECT MAX(mcs.timestamp)
                        FROM Messages mcs
                        LEFT JOIN Contacts c_sub ON mcs.contactId = c_sub.id
                        WHERE mcs.ticketId = t.id
                          AND ( mcs.body NOT LIKE CONCAT(UNHEX('E2808E'), '%')
                            AND (mcs.isPrivate IS NULL OR mcs.isPrivate != 1)
                            AND ( mcs.fromMe = 1
                                OR c_sub.isCompanyMember = '1'
                                OR c_sub.number IN (${allWhatasappIds})
                            )
                          )
                      )
                ) as firstLastClientMessageTimestamp,
                MIN( CASE
                      WHEN t.id = m.ticketId
                        AND m.body NOT LIKE CONCAT(UNHEX('E2808E'), '%')
                        AND (m.isPrivate IS NULL OR m.isPrivate != 1)
                        AND (m.fromMe = 1
                        OR c.isCompanyMember = '1'
                        OR c.number IN (${allWhatasappIds}) )
                      THEN m.timestamp END
                ) as firstCSMessageTimestamp,
                MAX( CASE
                      WHEN t.id = m.ticketId
                        AND m.body NOT LIKE CONCAT(UNHEX('E2808E'), '%')
                        AND (m.isPrivate IS NULL OR m.isPrivate != 1)
                        AND (m.fromMe = 1
                        OR c.isCompanyMember = '1'
                        OR c.number IN (${allWhatasappIds}))
                      THEN m.timestamp END
                ) as lastCSMessageTimestamp
              FROM Tickets t
              INNER JOIN Messages m ON t.id = m.ticketId
              LEFT JOIN Contacts c ON m.contactId = c.id
              WHERE t.id in (${ticketsIds})
              GROUP BY t.id `;

  const ticketListFind = await Ticket.sequelize.query(sql, {
    type: QueryTypes.SELECT,
    logging(sql, timing) {
      console.log(sql);
    }
  });

  ticketListFind.forEach((ticketData: any) => {
    let withResponse = false;

    let {
      fistTicketMessageTimestamp,
      firstClientMessageTimestamp,
      firstLastClientMessageTimestamp,
      firstCSMessageTimestamp,
      lastCSMessageTimestamp,
      createdAt,
      id
    } = ticketData;

    if (
      firstClientMessageTimestamp === null &&
      fistTicketMessageTimestamp === null &&
      firstLastClientMessageTimestamp === null &&
      lastCSMessageTimestamp === null &&
      firstCSMessageTimestamp === null
    ) {
      const timeAuxCreated = convertDateStrToTimestamp(createdAt);
      fistTicketMessageTimestamp = timeAuxCreated;
      firstLastClientMessageTimestamp = timeAuxCreated;
    }
    if (
      // si no hay primer ultimo mensaje del cliente
      (firstLastClientMessageTimestamp === null &&
        // y no primer mensaje del CS
        firstCSMessageTimestamp === null &&
        // y existe un primer mensaje en el ticket
        fistTicketMessageTimestamp !== null &&
        // y existe un primer mensaje del cliente
        firstClientMessageTimestamp !== null &&
        // y el primer mensaje del ticket y el primer mensaje del cliente no son iguales (por si en algun caso el primer mensaje del ticket no se considera mensaje del cliente)
        fistTicketMessageTimestamp !== firstClientMessageTimestamp) ||
      // si no hay primer ultimo mensaje del cliente
      (firstLastClientMessageTimestamp === null &&
        // y existe un ultimo mensaje del CS
        lastCSMessageTimestamp !== null) ||
      // si existe ultimo mensaje del CS
      (lastCSMessageTimestamp !== null &&
        // y hay primer ultimo mensaje del cliente
        firstLastClientMessageTimestamp !== null &&
        // y el ultimo mensaje del CS es mayor al primer ultimo mensaje del cliente (caso raro)
        lastCSMessageTimestamp > firstLastClientMessageTimestamp)
    ) {
      withResponse = true;
    }

    let beenWaitingSinceTimestamp = null;

    if (!withResponse) {
      if (firstLastClientMessageTimestamp !== null) {
        beenWaitingSinceTimestamp = firstLastClientMessageTimestamp;
      } else if (firstClientMessageTimestamp !== null) {
        beenWaitingSinceTimestamp = firstClientMessageTimestamp;
      } else if (fistTicketMessageTimestamp !== null) {
        beenWaitingSinceTimestamp = fistTicketMessageTimestamp;
      }
    }

    const ticketToUpdate = tickets.find(t => t.id === id);

    ticketToUpdate.update({
      beenWaitingSinceTimestamp
    });

    ticketToUpdate.beenWaitingSinceTimestamp = beenWaitingSinceTimestamp;
  });

  return tickets.length === 1 ? tickets[0] : tickets;
};

export default getAndSetBeenWaitingSinceTimestampTicketService;
