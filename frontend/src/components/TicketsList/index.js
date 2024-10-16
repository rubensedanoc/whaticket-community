import React, { useContext, useEffect, useReducer, useState } from "react";
import openSocket from "../../services/socket-io";

import List from "@material-ui/core/List";
import Paper from "@material-ui/core/Paper";
import { makeStyles } from "@material-ui/core/styles";

import TicketListItem from "../TicketListItem";
import TicketsListSkeleton from "../TicketsListSkeleton";

import { AuthContext } from "../../context/Auth/AuthContext";
import useTickets from "../../hooks/useTickets";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  ticketsListWrapper: {
    position: "relative",
    display: "flex",
    height: "100%",
    flexDirection: "column",
    overflow: "hidden",
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },

  ticketsList: {
    flex: 1,
    overflowY: "scroll",
    ...theme.scrollbarStyles,
    borderTop: "2px solid rgba(0, 0, 0, 0.12)",
  },

  ticketsListHeader: {
    color: "rgb(67, 83, 105)",
    zIndex: 2,
    backgroundColor: "white",
    borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },

  ticketsCount: {
    fontWeight: "normal",
    color: "rgb(104, 121, 146)",
    marginLeft: "8px",
    fontSize: "14px",
  },

  noTicketsText: {
    textAlign: "center",
    color: "rgb(104, 121, 146)",
    fontSize: "14px",
    lineHeight: "1.4",
  },

  noTicketsTitle: {
    textAlign: "center",
    fontSize: "16px",
    fontWeight: "600",
    margin: "0px",
  },

  noTicketsDiv: {
    display: "flex",
    height: "100px",
    margin: 40,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
}));

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

  if (action.type === "VERIFY_IF_TICKET_IS_IN_TICKETlIST_TO_REMOVE_IT") {
    const { ticket, setUpdatedCount } = action.payload;

    const ticketIndex = state.findIndex((t) => t.id === ticket.id);

    if (ticketIndex !== -1) {
      state.splice(ticketIndex, 1);
      setUpdatedCount((oldCount) => oldCount - 1);
    }

    return [...state];
  }

  if (action.type === "UPDATE_TICKET_UNREAD_MESSAGES") {
    const { ticket, setUpdatedCount } = action.payload;

    const ticketIndex = state.findIndex((t) => t.id === ticket.id);
    if (ticketIndex !== -1) {
      // console.log(
      //   "UPDATE_TICKET_UNREAD_MESSAGES ticket old:",
      //   JSON.parse(JSON.stringify(state[ticketIndex]))
      // );

      if (state[ticketIndex]?.contact?.isExclusive && ticket.contact) {
        ticket.contact.isExclusive = true;
      }

      // console.log(
      //   "UPDATE_TICKET_UNREAD_MESSAGES ticket new:",
      //   JSON.parse(JSON.stringify(ticket))
      // );

      state[ticketIndex] = {
        ...state[ticketIndex],
        ...ticket,
        clientTimeWaiting: ticket.clientTimeWaiting,
      };
      state.unshift(state.splice(ticketIndex, 1)[0]);
    } else {
      state.unshift(ticket);
      setUpdatedCount((oldCount) => oldCount + 1);
    }

    // console.log(
    //   "UPDATE_TICKET_UNREAD_MESSAGES after:",
    //   JSON.parse(JSON.stringify(state))
    // );

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
    if (ticketIndex !== -1) {
      state.splice(ticketIndex, 1);
      setUpdatedCount((oldCount) => oldCount - 1);
    }

    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const TicketsList = (props) => {
  const {
    status,
    searchParam,
    showAll,
    selectedWhatsappIds,
    selectedQueueIds,
    selectedTypeIds,
    updateCount,
    style,
    showOnlyMyGroups = false,
  } = props;
  const classes = useStyles();
  const [pageNumber, setPageNumber] = useState(1);
  const [ticketsList, dispatch] = useReducer(reducer, []);
  const [updatedCount, setUpdatedCount] = useState(0);
  const [microServiceLoading, setMicroServiceLoading] = useState(false);
  const { user } = useContext(AuthContext);

  useEffect(() => {
    // console.log("RESET: ");

    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [
    status,
    searchParam,
    dispatch,
    showAll,
    selectedWhatsappIds,
    selectedQueueIds,
    selectedTypeIds,
    showOnlyMyGroups,
  ]);

  const { tickets, hasMore, loading, count } = useTickets({
    pageNumber,
    searchParam,
    status,
    showAll,
    whatsappIds: JSON.stringify(selectedWhatsappIds),
    queueIds: JSON.stringify(selectedQueueIds),
    typeIds: JSON.stringify(selectedTypeIds),
    showOnlyMyGroups,
  });

  useEffect(() => {
    // console.log("PREV_TICKETS - STATUS:", status, "SEARCH_PARAM:", searchParam);
    if (!status && !searchParam) return;

    (async () => {
      // setMicroServiceLoading(true);

      // let ticketsToDispatch = await searchIfTicketsContactIsExclusive(tickets);

      // setMicroServiceLoading(false);

      dispatch({
        type: "LOAD_TICKETS",
        payload: tickets,
      });
    })();
  }, [tickets]);

  useEffect(() => {
    setUpdatedCount(count);
  }, [count]);

  useEffect(() => {
    if (typeof updateCount === "function") {
      updateCount(updatedCount);
    }
  }, [updatedCount]);

  useEffect(() => {
    const socket = openSocket();

    const shouldUpdateTicket = (ticket) => {
      // console.log({ selectedQueueIds });
      // console.log("shouldUpdateTicket: ", ticket);
      // console.log("USER: ", user);

      const noSearchParam = !searchParam;
      const userCondition =
        (!ticket.userId && !ticket.isGroup) ||
        (ticket.userId === user?.id && !ticket.isGroup) ||
        (ticket.helpUsers?.find((hu) => hu.id === user?.id) &&
          !ticket.isGroup) ||
        (ticket.participantUsers?.find((pu) => pu.id === user?.id) &&
          ticket.isGroup) ||
        (!ticket.isGroup &&
          showAll &&
          selectedTypeIds.length === 1 &&
          selectedTypeIds[0] === "individual") ||
        (ticket.isGroup &&
          !showOnlyMyGroups &&
          selectedTypeIds.length === 1 &&
          selectedTypeIds[0] === "group");
      const queueCondition =
        (!ticket.queueId && selectedQueueIds.includes(null)) ||
        selectedQueueIds.indexOf(ticket.queueId) !== -1 ||
        selectedQueueIds?.length === 0;
      const typeCondition =
        (ticket.isGroup && selectedTypeIds[0] === "group") ||
        (!ticket.isGroup && selectedTypeIds[0] === "individual");
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

      const isConditionMet =
        noSearchParam &&
        userCondition &&
        typeCondition &&
        (ignoreConditions || (queueCondition && whatsappCondition));

      // console.log("noSearchParam", noSearchParam);
      // console.log("userCondition", userCondition);
      // console.log("typeCondition", typeCondition);
      // console.log("ignoreConditions", ignoreConditions);
      // console.log("||||||||||queueCondition", queueCondition);
      // console.log("whatsappCondition", whatsappCondition);
      // console.log(isConditionMet ? "PASÓ" : "NO PASÓ");

      return isConditionMet;
    };

    const notBelongsToUserQueues = (ticket) => {
      const queueCondition =
        (!ticket.queueId && selectedQueueIds.includes(null)) ||
        selectedQueueIds.indexOf(ticket.queueId) !== -1 ||
        selectedQueueIds?.length === 0;

      return !queueCondition;
    };

    // const notBelongsToUserQueues = (ticket) =>
    //   ticket.queueId && selectedQueueIds.indexOf(ticket.queueId) === -1;

    socket.on("connect", () => {
      if (status) {
        socket.emit("joinTickets", status);
      } else {
        socket.emit("joinNotification");
      }
    });

    socket.on("ticket", async (data) => {
      // console.log("ticket socket::::::::::::::::::::", data);
      // console.log("selectedWhatsappIds: ", selectedWhatsappIds);

      if (data.action === "updateUnread") {
        dispatch({
          type: "RESET_UNREAD",
          payload: data.ticketId,
        });
      }

      if (data.action === "update" && shouldUpdateTicket(data.ticket)) {
        // const ticketToDispatch = (
        //   await searchIfTicketsContactIsExclusive([data.ticket])
        // )[0];

        dispatch({
          type: "UPDATE_TICKET",
          payload: {
            ticket: data.ticket,
            setUpdatedCount,
          },
        });
      }

      if (data.action === "update" && notBelongsToUserQueues(data.ticket)) {
        dispatch({
          type: "DELETE_TICKET",
          payload: { ticketId: data.ticket.id, setUpdatedCount },
        });
      }

      if (data.action === "delete") {
        dispatch({
          type: "DELETE_TICKET",
          payload: { ticketId: data.ticketId, setUpdatedCount },
        });
      }

      if (data.action === "update" && !shouldUpdateTicket(data.ticket)) {
        dispatch({
          type: "VERIFY_IF_TICKET_IS_IN_TICKETlIST_TO_REMOVE_IT",
          payload: { ticket: data.ticket, user, setUpdatedCount },
        });
      }
    });

    socket.on("appMessage", (data) => {
      // console.log("appMessage socket::::::::::::::::::::", data);
      if (data.action === "create" && shouldUpdateTicket(data.ticket)) {
        dispatch({
          type: "UPDATE_TICKET_UNREAD_MESSAGES",
          payload: { ticket: data.ticket, setUpdatedCount },
        });
      }
    });

    socket.on("contact", async (data) => {
      // console.log("contact socket::::::::::::::::::::", data);
      if (data.action === "update") {
        // const contactIsExclusive = await searchIfContactIsExclusive(
        //   data.contact?.number
        // );

        // console.log("contact socket::::::::::::::::::::", data);
        // console.log("contactIsExclusive: ", contactIsExclusive);

        // if (contactIsExclusive) {
        //   data.contact.isExclusive = true;
        // }

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
  ]);

  // async function searchIfTicketsContactIsExclusive(tickets) {
  //   let ticketsCopy = JSON.parse(JSON.stringify(tickets));

  //   const contactNumbersOfTicket = ticketsCopy
  //     ?.map((ticket) => ticket?.contact?.number)
  //     .filter((number) => number);

  //   if (contactNumbersOfTicket?.length) {
  //     try {
  //       let { data: newTicketsContactsNumbersMicroserviceData } =
  //         await microserviceApi.post(
  //           "/backendrestaurantpe/public/rest/common/localbi/searchPhoneList",
  //           contactNumbersOfTicket
  //         );

  //       // console.log(
  //       //   "newTicketsContactsNumbersMicroserviceData: ",
  //       //   newTicketsContactsNumbersMicroserviceData
  //       // );

  //       newTicketsContactsNumbersMicroserviceData =
  //         newTicketsContactsNumbersMicroserviceData?.data;

  //       newTicketsContactsNumbersMicroserviceData = Object.fromEntries(
  //         Object.entries(newTicketsContactsNumbersMicroserviceData).filter(
  //           ([key, value]) => value.some((entry) => entry.isExclusive === true)
  //         )
  //       );

  //       Object.keys(newTicketsContactsNumbersMicroserviceData).forEach(
  //         (key) => {
  //           ticketsCopy.forEach((ticket) => {
  //             if (ticket.contact && ticket.contact.number === key) {
  //               ticket.contact.isExclusive = true;
  //               // console.log("||||||||||||||ticket encontrado", ticket);
  //             }
  //           });
  //         }
  //       );
  //     } catch (error) {
  //       console.log("error", error);
  //     }
  //   }

  //   return ticketsCopy;
  // }

  // async function searchIfContactIsExclusive(contactNumber) {
  //   if (contactNumber) {
  //     try {
  //       let { data } = await microserviceApi.post(
  //         "/backendrestaurantpe/public/rest/common/localbi/searchPhoneList",
  //         [contactNumber]
  //       );

  //       console.log("searchIfContactIsExclusive:", data.data);

  //       if (data.data && data.data[contactNumber]) {
  //         return true;
  //       }
  //     } catch (error) {
  //       console.log("error", error);
  //     }
  //   }
  //   return false;
  // }

  // useEffect(() => {
  //   if (typeof updateCount === "function") {
  //     updateCount(ticketsList.length);
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [ticketsList]);

  const loadMore = () => {
    setPageNumber((prevState) => prevState + 1);
  };

  const handleScroll = (e) => {
    if (!hasMore || loading || microServiceLoading) return;

    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;

    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      e.currentTarget.scrollTop = scrollTop - 100;
      loadMore();
    }
  };

  return (
    <Paper className={classes.ticketsListWrapper} style={style}>
      <Paper
        square
        name="closed"
        elevation={0}
        className={classes.ticketsList}
        onScroll={handleScroll}
      >
        <List style={{ paddingTop: 0 }}>
          {ticketsList.length === 0 && !loading && !microServiceLoading ? (
            <div className={classes.noTicketsDiv}>
              <span className={classes.noTicketsTitle}>
                {i18n.t("ticketsList.noTicketsTitle")}
              </span>
              <p className={classes.noTicketsText}>
                {i18n.t("ticketsList.noTicketsMessage")}
              </p>
            </div>
          ) : (
            <>
              {ticketsList.map((ticket) => (
                <TicketListItem ticket={ticket} key={ticket.id} />
              ))}
            </>
          )}
          {(loading || microServiceLoading) && <TicketsListSkeleton />}
        </List>
      </Paper>
    </Paper>
  );
};

export default TicketsList;
