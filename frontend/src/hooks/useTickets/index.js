import { useEffect, useState } from "react";
import { getHoursCloseTicketsAuto } from "../../config";
import toastError from "../../errors/toastError";

import api from "../../services/api";

const useTickets = ({
  searchParam,
  pageNumber,
  status,
  showAll,
  whatsappIds,
  queueIds,
  marketingCampaignIds,
  typeIds,
  showOnlyMyGroups,
  categoryId,
  showOnlyWaitingTickets,
  filterByUserQueue = false,
  clientelicenciaEtapaIds,
  advancedList = false,
  ticketUsersIds
}) => {
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [count, setCount] = useState(0);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchTickets = async () => {
        try {
          let data;

          if (advancedList) {
            let { data: advancedData } = await api.get("/tickets/advanced", {
              params: {
                searchParam,
                pageNumber,
                status,
                showAll,
                whatsappIds,
                queueIds,
                ticketUsersIds,
                marketingCampaignIds,
                typeIds,
                showOnlyMyGroups,
                categoryId,
                showOnlyWaitingTickets,
                // filterByUserQueue,
                clientelicenciaEtapaIds,
                ticketGroupType: advancedList
              },
            });

            data = advancedData
          } else {
            const { data: normalData } = await api.get("/tickets", {
              params: {
                searchParam,
                pageNumber,
                status,
                showAll,
                whatsappIds,
                queueIds,
                ticketUsersIds,
                marketingCampaignIds,
                typeIds,
                showOnlyMyGroups,
                categoryId,
                showOnlyWaitingTickets,
                filterByUserQueue,
                clientelicenciaEtapaIds
              },
            });

            data = normalData;
          }

          setTickets(data.tickets);

          let horasFecharAutomaticamente = getHoursCloseTicketsAuto();

          if (
            status === "open" &&
            horasFecharAutomaticamente &&
            horasFecharAutomaticamente !== "" &&
            horasFecharAutomaticamente !== "0" &&
            Number(horasFecharAutomaticamente) > 0
          ) {
            let dataLimite = new Date();
            dataLimite.setHours(
              dataLimite.getHours() - Number(horasFecharAutomaticamente)
            );

            data.tickets.forEach((ticket) => {
              if (ticket.status !== "closed") {
                let dataUltimaInteracaoChamado = new Date(ticket.updatedAt);
                if (dataUltimaInteracaoChamado < dataLimite)
                  closeTicket(ticket);
              }
            });
          }

          setHasMore(data.hasMore);
          setCount(data.count);
          setLoading(false);
        } catch (err) {
          setLoading(false);
          toastError(err);
        }
      };

      const closeTicket = async (ticket) => {
        await api.put(`/tickets/${ticket.id}`, {
          status: "closed",
          userId: ticket.userId || null,
        });
      };

      fetchTickets();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [
    searchParam,
    pageNumber,
    status,
    showAll,
    whatsappIds,
    queueIds,
    ticketUsersIds,
    marketingCampaignIds,
    typeIds,
    showOnlyMyGroups,
    showOnlyWaitingTickets,
    reload,
    clientelicenciaEtapaIds
  ]);

  const triggerReload = () => {
    setReload((prev) => prev + 1);
  };

  return { tickets, loading, hasMore, count, triggerReload };
};

export default useTickets;
