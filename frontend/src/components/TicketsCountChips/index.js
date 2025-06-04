import React, { useContext, useEffect, useReducer, useState } from "react";
import openSocket from "../../services/socket-io";

import Chip from "@material-ui/core/Chip";
import { AuthContext } from "../../context/Auth/AuthContext";
import { ReloadDataBecauseSocketContext } from "../../context/ReloadDataBecauseSocketContext";
import useTickets from "../../hooks/useTickets";

const reducer = (state, action) => {
  console.log("REDUCER: ", action.type, action.payload);

  if (action.type === "LOAD_TICKETS") {
    const newTickets = action.payload;

    // console.log("_________newTickets", newTickets);

    newTickets.forEach((ticket) => {
      const ticketIndex = state.findIndex((t) => t.id === ticket.id);
      if (ticketIndex !== -1) {
        state[ticketIndex] = ticket;
        if (ticket.unreadMessages > 0) {
          state.unshift(state.splice(ticketIndex, 1)[0]);
        }
      } else {
        // if no ticket with same id, search for ticket with same contactId and whatsappId
        // this for dont have more than 1 ticket for contact-wpp
        const ticketWithSameContactIdAndWhatsappId = state.find(
          (t) =>
            t.contactId === ticket.contactId &&
            t.whatsappId === ticket.whatsappId
        );

        if (!ticketWithSameContactIdAndWhatsappId) {
          state.push(ticket);
        }
      }
    });
    return [...state];
  }

  if (action.type === "RESET_UNREAD") {
    const ticketId = action.payload;

    const ticketIndex = state.findIndex((t) => t.id === ticketId);
    if (ticketIndex !== -1) {
      state[ticketIndex].unreadMessages = 0;
    }

    return [...state];
  }

  if (action.type === "UPDATE_TICKET") {
    const { ticket, setUpdatedCount } = action.payload;

    const ticketIndex = state.findIndex((t) => t.id === ticket.id);
    if (ticketIndex !== -1) {
      state[ticketIndex] = ticket;
    } else {
      state.unshift(ticket);
      setUpdatedCount((oldCount) => oldCount + 1);
    }

    return [...state];
  }

  if (action.type === "UPDATE_TICKET_UNREAD_MESSAGES") {
    const { ticket, setUpdatedCount } = action.payload;

    const ticketIndex = state.findIndex((t) => t.id === ticket.id);

    if (ticketIndex !== -1) {
      if (state[ticketIndex]?.contact?.isExclusive && ticket.contact) {
        ticket.contact.isExclusive = true;
      }
      state[ticketIndex] = {
        ...state[ticketIndex],
        ...ticket,
        beenWaitingSinceTimestamp: ticket.beenWaitingSinceTimestamp,
      };
      state.unshift(state.splice(ticketIndex, 1)[0]);
    } else {
      state.unshift(ticket);
      setUpdatedCount((oldCount) => oldCount + 1);
    }

    return [...state];
  }

  if (action.type === "UPDATE_TICKET_CONTACT") {
    const contact = action.payload;
    const ticketIndex = state.findIndex((t) => t.contactId === contact.id);
    if (ticketIndex !== -1) {
      state[ticketIndex].contact = contact;
    }
    return [...state];
  }

  if (action.type === "DELETE_TICKET") {
    const { ticketId, setUpdatedCount } = action.payload;
    const ticketIndex = state.findIndex((t) => t.id === ticketId);

    console.log("DELETE TICKET LIST", state);

    if (ticketIndex !== -1) {
      console.log("SE ENCONTRO TICKET AHORA A DELETE_TICKET", ticketId);
      state.splice(ticketIndex, 1);
      setUpdatedCount((oldCount) => oldCount - 1);
    } else {
      console.log("NO SE ENCONTRO TICKET AHORA A DELETE_TICKET", ticketId);
    }

    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const TicketsCountChips = (props) => {
  const {
    status,
    searchParam,
    showAll,
    selectedWhatsappIds,
    selectedQueueIds,
    selectedMarketingCampaignIds,
    selectedTypeIds,
    showOnlyMyGroups,
    ticketsType,
    category,
    showOnlyWaitingTickets,
    chipLabel = "",
    selectedClientelicenciaEtapaIds,
    clientelicenciaEtapaIds,
    onClick = () => {},
  } = props;

  const { user } = useContext(AuthContext);
  const { reconnect } = useContext(ReloadDataBecauseSocketContext);

  const [ticketsList, dispatch] = useReducer(reducer, []);
  const [pageNumber, setPageNumber] = useState(1);
  const [updatedCount, setUpdatedCount] = useState(0);

  useEffect(() => {
    console.log("------------------------ SE VA A DISPARAR RESET ------------------------");
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [
    status,
    searchParam,
    dispatch,
    showAll,
    showOnlyMyGroups,
    selectedWhatsappIds,
    selectedQueueIds,
    selectedMarketingCampaignIds,
    selectedTypeIds,
    showOnlyWaitingTickets,
    clientelicenciaEtapaIds
  ]);

  const { tickets, hasMore, loading, count, triggerReload } = useTickets({
    pageNumber,
    searchParam,
    status,
    showAll,
    whatsappIds: JSON.stringify(selectedWhatsappIds),
    queueIds: JSON.stringify(selectedQueueIds),
    marketingCampaignIds: JSON.stringify(selectedMarketingCampaignIds),
    typeIds: JSON.stringify(selectedTypeIds),
    clientelicenciaEtapaIds: JSON.stringify(clientelicenciaEtapaIds),
    showOnlyMyGroups,
    showOnlyWaitingTickets,
    ...(category && { categoryId: category.id }),
    ...(ticketsType === "no-category" && { categoryId: 0 }),
    filterByUserQueue: true,
  });

  useEffect(() => {
    if (!status && !searchParam) return;

    (async () => {
      dispatch({
        type: "LOAD_TICKETS",
        payload: tickets,
      });

      console.log("Tickets loaded:", tickets);
      
    })();
  }, [tickets]);

  useEffect(() => {
    setUpdatedCount(count);
  }, [count]);

  useEffect(() => {
    console.log("RECONNECT", reconnect);
    if (reconnect) {
      dispatch({ type: "RESET" });
      setPageNumber(1);
      triggerReload();
    }
  }, [reconnect]);

  useEffect(() => {
    const socket = openSocket();

    const shouldUpdateTicket = (ticket) => {

      // console.log("shouldUpdateTicket", ticket);

      const noSearchParamCondition = !searchParam;

      const TypeCondition =
        (!ticket.isGroup && selectedTypeIds?.includes("individual")) ||
        (ticket.isGroup && selectedTypeIds?.includes("group"));

      const userCondition =
        (!ticket.isGroup &&
          ((!ticket.userId && status === "pending") ||
            (ticket.userId === user?.id && status === "open") ||
            (ticket.helpUsers?.find((hu) => hu.id === user?.id) &&
              status === "open") ||
            showAll)) ||
        (ticket.isGroup &&
          (ticket.participantUsers?.find((pu) => pu.id === user?.id) ||
            !showOnlyMyGroups));

      const queueCondition =
        (!ticket.queueId &&
          (selectedQueueIds.includes(null) ||
            selectedQueueIds?.length === 0)) ||
        selectedQueueIds.indexOf(ticket.queueId) !== -1 ||
        (selectedQueueIds?.length === 0 &&
          user?.queues?.find((q) => q?.id === ticket.queueId));

      const marketingCampaignCondition =
        (!ticket.marketingCampaignId &&
          selectedMarketingCampaignIds.includes(null)) ||
        selectedMarketingCampaignIds.indexOf(ticket.marketingCampaignId) !==
          -1 ||
        selectedMarketingCampaignIds?.length === 0;

      const whatsappCondition =
        selectedWhatsappIds?.indexOf(ticket.whatsappId) > -1 ||
        selectedWhatsappIds?.length === 0;

      const ignoreConditions =
        (!ticket.isGroup &&
          selectedTypeIds.length === 1 &&
          selectedTypeIds[0] === "individual" &&
          !showAll) ||
        (ticket.isGroup &&
          selectedTypeIds.length === 1 &&
          selectedTypeIds[0] === "group" &&
          showOnlyMyGroups);

      const categoryCondition =
        (!category && ticketsType !== "no-category") ||
        (category && ticket.categories.find((tc) => tc.id === category.id)) ||
        (ticketsType === "no-category" && !ticket.categories?.length);

      const clientelicenciaEtapaIdCondition =
        clientelicenciaEtapaIds?.length === 0 ||
        clientelicenciaEtapaIds?.some((id) => ticket.contact.traza_clientelicencia_currentetapaid === id);

      console.log("shouldUpdateTicket clientelicenciaEtapaIdCondition clientelicenciaEtapaIds", clientelicenciaEtapaIds);
      console.log("shouldUpdateTicket clientelicenciaEtapaIdCondition ticket.contact.traza_clientelicencia_currentetapaid", ticket.contact.traza_clientelicencia_currentetapaid);
      console.log("shouldUpdateTicket clientelicenciaEtapaIdCondition", clientelicenciaEtapaIdCondition);

      // console.log({
      //   noSearchParamCondition,
      //   TypeCondition,
      //   userCondition,
      //   queueCondition,
      //   whatsappCondition,
      //   ignoreConditions,
      //   categoryCondition,
      // });

      const isConditionMet =
        noSearchParamCondition &&
        TypeCondition &&
        userCondition &&
        (ignoreConditions ||
          (queueCondition &&
            whatsappCondition &&
            marketingCampaignCondition)) &&
        categoryCondition && clientelicenciaEtapaIdCondition;

      return isConditionMet;
    };

    socket.on("connect", () => {
      if (status) {
        socket.emit("joinTickets", status);
      } else {
        socket.emit("joinNotification");
      }

      // setWasDisConnected((prevState) => {
      //   if (prevState === 'disconnected') {
      //     toast.success("Conexión al servidor restablecida");
      //     // window.location.reload();
      //     dispatch({ type: "RESET" });
      //     setPageNumber(1);
      //   }
      //   return 'connected';
      // });
    });

    socket.on("ticket", async (data) => {
      if (data.action === "updateUnread") {
        dispatch({
          type: "RESET_UNREAD", // si encuentra el ticket en el estado le resetea los mensajes no leidos
          payload: data.ticketId,
        });
      }

      if (data.action === "update") {
        if (
          shouldUpdateTicket(data.ticket) &&
          (!showOnlyWaitingTickets ||
            (showOnlyWaitingTickets && data.ticket?.beenWaitingSinceTimestamp))
        ) {
          console.log("UPDATE_TICKET");
          dispatch({
            type: "UPDATE_TICKET", // si encuentra el ticket en el estado lo actualiza sino lo agrega
            payload: {
              ticket: data.ticket,
              setUpdatedCount,
            },
          });
        } else {
          console.log("DELETE_TICKET");
          dispatch({
            type: "DELETE_TICKET", // si encuentra el ticket en el estado lo elimina
            payload: { ticketId: data.ticket?.id, user, setUpdatedCount },
          });
        }
      }

      if (data.action === "delete") {
        dispatch({
          type: "DELETE_TICKET", // si encuentra el ticket en el estado lo elimina
          payload: { ticketId: data.ticketId, setUpdatedCount },
        });
      }
    });

    socket.on("appMessage", (data) => {
      if (data.action === "create") {
        if (
          shouldUpdateTicket(data.ticket) &&
          (!showOnlyWaitingTickets ||
            (showOnlyWaitingTickets && data.ticket?.beenWaitingSinceTimestamp))
        ) {
          dispatch({
            type: "UPDATE_TICKET_UNREAD_MESSAGES",
            payload: { ticket: data.ticket, setUpdatedCount },
          });
        } else {
          dispatch({
            type: "DELETE_TICKET", // si encuentra el ticket en el estado lo elimina
            payload: { ticketId: data.ticket?.id, setUpdatedCount },
          });
        }
      }
    });

    socket.on("contact", async (data) => {
      // console.log("contact socket::::::::::::::::::::", data);
      if (data.action === "update") {
        dispatch({
          type: "UPDATE_TICKET_CONTACT",
          payload: data.contact,
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [
    status,
    searchParam,
    showAll,
    user,
    selectedQueueIds,
    selectedTypeIds,
    selectedWhatsappIds,
    showOnlyMyGroups,
    showOnlyWaitingTickets,
    clientelicenciaEtapaIds
  ]);

  const chipIsSelected = clientelicenciaEtapaIds.every(
    (id) => selectedClientelicenciaEtapaIds?.includes(id)
  );

  return (
    <Chip
      onClick={() => {
        onClick();
}}
      size="small"
      color={chipIsSelected ? "primary" : "default"}
      label={
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        {chipLabel} {updatedCount}
        {/* <b>{updatedCount}</b> */}
        </div>
      }
    />
  );
};

export default TicketsCountChips;
