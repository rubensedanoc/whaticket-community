import { useEffect, useState, useRef } from "react";
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
  ticketUsersIds,
  accountManagerIds,
  viewSource = null,
  impersonatedUserId,
  waitingTimeRanges
}) => {
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [count, setCount] = useState(0);
  const [reload, setReload] = useState(0);
  
  // ✅ Refs para cancelar requests anteriores y evitar consultas simultáneas
  const abortControllerRef = useRef(null);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    // 🔍 LOG: Inicio de useEffect
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    console.log(`[useTickets] 🚀 INICIO useEffect [${requestId}]`, {
      searchParam,
      pageNumber,
      status,
      queueIds,
      ticketUsersIds,
      accountManagerIds,
      categoryId,
      showOnlyWaitingTickets,
      advancedList,
      viewSource,
      timestamp: new Date().toISOString()
    });

    // ⚠️ Si ya hay un fetch en progreso, cancelarlo
    if (abortControllerRef.current) {
      console.log(`[useTickets] 🛑 Cancelando request anterior [${requestId}]`);
      abortControllerRef.current.abort();
    }

    // Crear nuevo AbortController para este fetch
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setLoading(true);

    const fetchTickets = async () => {
        try {
          console.time(`[useTickets] ⏱️ fetchTickets [${requestId}]`);
          console.log(`[useTickets] 🔄 Iniciando fetchTickets [${requestId}]`);
          
          isFetchingRef.current = true;
          let data;

          if (advancedList) {
            console.log(`[useTickets] 📡 Llamando /tickets/advanced [${requestId}]`);
            let { data: advancedData } = await api.get("/tickets/advanced", {
              params: {
                searchParam,
                pageNumber,
                status,
                showAll,
                whatsappIds,
                queueIds,
                ticketUsersIds,
                accountManagerIds,
                marketingCampaignIds,
                typeIds,
                showOnlyMyGroups,
                categoryId,
                showOnlyWaitingTickets,
                // filterByUserQueue,
                clientelicenciaEtapaIds,
                ticketGroupType: advancedList,
                viewSource,
                impersonatedUserId,
                waitingTimeRanges: JSON.stringify(waitingTimeRanges)
              },
              signal // ✅ Pasar signal para cancelación
            });
            console.log(`[useTickets] ✅ Respuesta /tickets/advanced [${requestId}]`, {
              tickets: advancedData.tickets?.length,
              count: advancedData.count
            });

            data = advancedData
          } else {
            console.log(`[useTickets] 📡 Llamando /tickets [${requestId}]`);
            const { data: normalData } = await api.get("/tickets", {
              params: {
                searchParam,
                pageNumber,
                status,
                showAll,
                whatsappIds,
                queueIds,
                ticketUsersIds,
                accountManagerIds,
                marketingCampaignIds,
                typeIds,
                showOnlyMyGroups,
                categoryId,
                showOnlyWaitingTickets,
                filterByUserQueue,
                clientelicenciaEtapaIds,
                viewSource,
                waitingTimeRanges: JSON.stringify(waitingTimeRanges)
              },
              signal // ✅ Pasar signal para cancelación
            });
            console.log(`[useTickets] ✅ Respuesta /tickets [${requestId}]`, {
              tickets: normalData.tickets?.length,
              count: normalData.count
            });

            data = normalData;
          }

          // ✅ Solo actualizar state si el request no fue cancelado
          if (!signal.aborted) {
            console.log(`[useTickets] 💾 Actualizando state [${requestId}]`, {
              ticketsCount: data.tickets.length
            });
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
            
            console.timeEnd(`[useTickets] ⏱️ fetchTickets [${requestId}]`);
            console.log(`[useTickets] 🏁 FIN fetchTickets [${requestId}]`, {
              ticketsDevueltos: data.tickets.length,
              totalCount: data.count,
              hasMore: data.hasMore
            });
          } else {
            console.log(`[useTickets] 🛑 Request fue abortado, no se actualiza state [${requestId}]`);
          }
        } catch (err) {
          console.timeEnd(`[useTickets] ⏱️ fetchTickets [${requestId}]`);
          // ✅ No mostrar error si fue cancelación intencional
          if (err.name === 'CanceledError' || err.message?.includes('canceled')) {
            console.log(`[useTickets] ✅ Request cancelado correctamente [${requestId}]`);
          } else {
            console.error(`[useTickets] ❌ ERROR [${requestId}]`, err);
            setLoading(false);
            toastError(err);
          }
        } finally {
          isFetchingRef.current = false;
        }
      };

      const closeTicket = async (ticket) => {
        await api.put(`/tickets/${ticket.id}`, {
          status: "closed",
          userId: ticket.userId || null,
        });
      };

      fetchTickets();
    
    return () => {
      // ✅ Cancelar request si el componente se desmonta o cambian los params
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
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
    clientelicenciaEtapaIds,
    impersonatedUserId,
    JSON.stringify(waitingTimeRanges) // ✅ Dependencia para recargar si cambia el filtro
  ]);

  const triggerReload = () => {
    setReload((prev) => prev + 1);
  };

  return { tickets, loading, hasMore, count, triggerReload };
};

export default useTickets;
