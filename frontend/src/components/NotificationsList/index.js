import React, { useContext, useEffect, useReducer, useState } from "react";
import openSocket from "../../services/socket-io";

import List from "@material-ui/core/List";
import Paper from "@material-ui/core/Paper";
import { makeStyles } from "@material-ui/core/styles";

import { blue } from "@material-ui/core/colors";
import { AuthContext } from "../../context/Auth/AuthContext";
import { ReloadDataBecauseSocketContext } from "../../context/ReloadDataBecauseSocketContext";
import { SearchMessageContext } from "../../context/SearchMessage/SearchMessageContext";
import useNotifications from "../../hooks/useNotifications";
import TicketsListSkeleton from "../TicketsListSkeleton";

import CircularProgress from "@material-ui/core/CircularProgress";
import api from "../../services/api";

import TicketListItem from "../TicketListItem";
import { NOTIFICATIONTYPES } from "../../constants.js";

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
    // height: "100px",
    padding: 40,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },

  buttonProgress: {
    color: blue[500],
    position: "absolute",
    bottom: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
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
        state.push(ticket);
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

  if (action.type === "ADD_NOTIFICATION") {
    const { ticket } = action.payload;

    state.unshift(ticket);

    return [...state];
  }

  if (action.type === "UPDATE_NOTIFICATION") {
    const { ticket } = action.payload;

    const ticketIndex = state.findIndex((t) => t.id === ticket.id);
    if (ticketIndex !== -1) {
      state[ticketIndex] = ticket;
    } else {
      state.unshift(ticket);
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

const NotificationsList = (props) => {
  const {
    status,
    searchParam,
    selectedWhatsappIds,
    selectedQueueIds,
    selectedUsersIds
  } = props;

  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const { reconnect } = useContext(ReloadDataBecauseSocketContext);

  const [ticketsList, dispatch] = useReducer(reducer, []);
  const [pageNumber, setPageNumber] = useState(1);
  const [updatedCount, setUpdatedCount] = useState(0);
  const [microServiceLoading, setMicroServiceLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  // const [wasDisConnected, setWasDisConnected] = useState('connecting');

  const { setSearchingMessageId } = useContext(SearchMessageContext);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [
    status,
    searchParam,
    dispatch,
    selectedUsersIds
  ]);

  const { tickets, hasMore, loading, count, triggerReload } = useNotifications({
    pageNumber,
    searchParam,
    status,
    selectedUsersIds: JSON.stringify(selectedUsersIds)
  });

  useEffect(() => {
    console.log("PREV_TICKETS - STATUS:", status, "SEARCH_PARAM:", searchParam);
    // if (!status && !searchParam) return;

    (async () => {
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
    console.log("RECONNECT", reconnect);
    if (reconnect) {
      dispatch({ type: "RESET" });
      setPageNumber(1);
      triggerReload();
    }
  }, [reconnect]);


  useEffect(() => {
    const socket = openSocket();

    const shouldUpdateNotification = (notification) => {
      if(selectedUsersIds.includes(notification.toUserId) || selectedUsersIds.length === 0) {
        return true;
      }
      return false;
    };

    socket.on("notification", (data) => {
      if (data.action === NOTIFICATIONTYPES.GROUP_MENTION_CREATE && shouldUpdateNotification(data.data)) {
        dispatch({
          type: "ADD_NOTIFICATION",
          payload: {
            ticket: data.data,
          },
        });
      }

      if (data.action === NOTIFICATIONTYPES.GROUP_MENTION_UPDATE && shouldUpdateNotification(data.data)) {
        dispatch({
          type: "UPDATE_NOTIFICATION",
          payload: {
            ticket: data.data,
          },
        });
      }
    });

    return () => {
      // setWasDisConnected('connecting');
      socket.disconnect();
    };
  }, [
    status,
    searchParam,
    user,
    selectedQueueIds,
    selectedWhatsappIds,
    selectedUsersIds
  ]);

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
    <Paper
      className={classes.ticketsListWrapper}
      style={{
        width: "100%",
        borderRadius: 8,
        flexShrink: 0,
      }}
    >
      <Paper
        square
        name="closed"
        elevation={0}
        className={classes.ticketsList}
        onScroll={handleScroll}
      >
        <List
          style={{
            paddingTop: 0,
            height: "100%",
            borderRadius: 8,
            position: "relative",
          }}
        >
          {ticketsList.length === 0 && !loading && !microServiceLoading ? (
            <div className={classes.noTicketsDiv}>
              <span className={classes.noTicketsTitle}>
                No se encontraron notificaciones
              </span>
            </div>
          ) : (
            <>
              {ticketsList.map((ticket) => (
                <TicketListItem 
                  ticket={ticket.ticket} 
                  messageToShow={ticket.message} 
                  notificacionUnseen={!ticket.seen}
                  extraActionOnSelect={()=>{
                    setSearchingMessageId(ticket.message?.id);
                    api.post("/notifications/seenNotification", {
                      notificationId: ticket.id,
                    })
                  }}
                  key={ticket.id} />
              ))}
            </>
          )}
          {(loading || microServiceLoading) && ticketsList.length > 0 && (
            <TicketsListSkeleton />
          )}
          {(loading || microServiceLoading) && ticketsList.length === 0 && (
            <CircularProgress size={44} className={classes.buttonProgress} />
          )}
        </List>
      </Paper>
    </Paper>
  );
};

export default NotificationsList;
