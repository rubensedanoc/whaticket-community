import React, { useContext, useEffect, useReducer, useState } from "react";
import openSocket from "../../services/socket-io";

import List from "@material-ui/core/List";
import Paper from "@material-ui/core/Paper";
import { makeStyles } from "@material-ui/core/styles";

import { blue } from "@material-ui/core/colors";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import ArrowDropDownIcon from "@material-ui/icons/ArrowDropDown";
import ArrowLeftIcon from "@material-ui/icons/ArrowLeft";
import ArrowRightIcon from "@material-ui/icons/ArrowRight";
import { AuthContext } from "../../context/Auth/AuthContext";
import { ReloadDataBecauseSocketContext } from "../../context/ReloadDataBecauseSocketContext";
import useTickets from "../../hooks/useTickets";
import TicketsListSkeleton from "../TicketsListSkeleton";

import CircularProgress from "@material-ui/core/CircularProgress";
import { i18n } from "../../translate/i18n";
import { Can } from "../Can";

import TicketListItem from "../TicketListItem";

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
  // console.log("REDUCER: ", action.type, action.payload);

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
    setShowAll,
    selectedWhatsappIds,
    selectedQueueIds,
    selectedMarketingCampaignIds,
    selectedTypeIds,
    style,
    showOnlyMyGroups,
    setShowOnlyMyGroups,
    ticketsType,
    category,
    onMoveToLeft,
    onMoveToRight,
    selectedCategoriesIds,
    showOnlyWaitingTickets,
    columnsWidth,
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
    showAll,
    showOnlyMyGroups,
    selectedWhatsappIds,
    selectedQueueIds,
    selectedMarketingCampaignIds,
    selectedTypeIds,
    showOnlyWaitingTickets,
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
    showOnlyMyGroups,
    showOnlyWaitingTickets,
    ...(category && { categoryId: category.id }),
    ...(ticketsType === "no-category" && { categoryId: 0 }),
    filterByUserQueue: true,
  });

  useEffect(() => {
    // console.log("PREV_TICKETS - STATUS:", status, "SEARCH_PARAM:", searchParam);
    if (!status && !searchParam) return;

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

  // useEffect(() => {
  //   if (typeof updateCount === "function") {
  //     updateCount(updatedCount);
  //   }
  // }, [updatedCount]);

  useEffect(() => {
    const socket = openSocket();

    const shouldUpdateTicket = (ticket) => {
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
        (!ticket.queueId && selectedQueueIds.includes(null)) ||
        selectedQueueIds.indexOf(ticket.queueId) !== -1 ||
        selectedQueueIds?.length === 0;

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
        categoryCondition;

      return isConditionMet;
    };

    // const notBelongsToUserQueues = (ticket) => {
    //   const queueCondition =
    //     (!ticket.queueId && selectedQueueIds.includes(null)) ||
    //     selectedQueueIds.indexOf(ticket.queueId) !== -1 ||
    //     selectedQueueIds?.length === 0;

    //   return !queueCondition;
    // };

    // const notBelongsToUserQueues = (ticket) =>
    //   ticket.queueId && selectedQueueIds.indexOf(ticket.queueId) === -1;

    socket.on("connect", () => {
      // console.log("-------------------------connect-------------------------");
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
      // console.log("ticket socket::::::::::::::::::::", data, {
      //   status,
      //   searchParam,
      //   showAll,
      //   selectedWhatsappIds,
      //   selectedQueueIds,
      //   selectedTypeIds,
      //   style,
      //   ticketsType,
      //   category,
      // });

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
          dispatch({
            type: "UPDATE_TICKET", // si encuentra el ticket en el estado lo actualiza sino lo agrega
            payload: {
              ticket: data.ticket,
              setUpdatedCount,
            },
          });
        } else {
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
      // console.log("ticket socket::::::::::::::::::::", data, {
      //   status,
      //   searchParam,
      //   showAll,
      //   selectedWhatsappIds,
      //   selectedQueueIds,
      //   selectedTypeIds,
      //   style,
      //   ticketsType,
      //   category,
      // });

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

    // socket.on("disconnect", () => {
    //   console.log(
    //     ".........................disconnect........................."
    //   );
    //   setWasDisConnected((prevState) => {
    //     if (prevState === 'connected') {
    //       toast.error("Te desconectaste del servidor, dale F5");
    //       return 'disconnected'
    //     }
    //     return prevState;
    //   });
    // });

    return () => {
      // setWasDisConnected('connecting');
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
        ...style,
        width:
          columnsWidth === "normal"
            ? "20rem"
            : columnsWidth === "large"
            ? "25rem"
            : "20rem",
        borderRadius: 8,
        flexShrink: 0,
        // Es la lista sin categoria o es lista de categoria
        ...((ticketsType === "no-category" || category) &&
        // la categoria esta marcada como no visible
        !selectedCategoriesIds.includes(category?.id || ticketsType) &&
        // Tenemos almenos un ticket y no estamos viendo mis tickets en caso de solo estar viendo solo individuales
        !(
          !showAll &&
          ticketsList.length > 0 &&
          selectedTypeIds.length === 1 &&
          selectedTypeIds[0] === "individual"
        ) &&
        // Tenemos almenos un ticket y no estamos viendo mis grupos en caso de solo esta viendo solo grupos
        !(
          showOnlyMyGroups &&
          ticketsList.length > 0 &&
          selectedTypeIds.length === 1 &&
          selectedTypeIds[0] === "group"
        ) &&
        // si estamos buscando un grupo y tenemos almenos un ticket en la columna y estamos viendo todos los grupos
        !(
          !showOnlyMyGroups &&
          searchParam &&
          ticketsList.length > 0 &&
          selectedTypeIds.length === 1 &&
          selectedTypeIds[0] === "group"
        ) // si todo eso se cumple ocultamos la lista
          ? {
              display: "none",
            }
          : null),
      }}
    >
      <div
        style={{
          // background: blue[500],
          background: category?.color || "rgb(181 181 181)",
          color: "white",
          fontWeight: "500",
          padding: "0.75rem",
          textAlign: "center",
          fontSize: "12px",
          letterSpacing: "1px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <div
          style={{
            background: "#2576d2",
            padding: "4px 6px",
            borderRadius: "999px",
            fontSize: "11px",
            lineHeight: "14px",
          }}
        >
          {updatedCount}
        </div>

        {(ticketsType === "groups" || ticketsType === "individuals") && (
          <>
            <div>
              {ticketsType === "groups" ? "GRUPOS" : "INDIVIDUALES"} -{" "}
              {ticketsType === "groups"
                ? !showOnlyMyGroups
                  ? "TODOS"
                  : "PARTICIPANDO"
                : showAll
                ? "TODOS"
                : "MIOS"}
            </div>

            <Can
              role={user.profile}
              perform="tickets-manager:showall"
              yes={() => (
                <>
                  <ArrowDropDownIcon
                    fontSize="medium"
                    onClick={handleClick}
                    style={{
                      cursor: "pointer",
                      scale: "1.5",
                    }}
                  />

                  <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleClose}
                  >
                    <MenuItem
                      onClick={(e) => {
                        if (ticketsType === "groups") {
                          localStorage.setItem(
                            "showOnlyMyGroups",
                            JSON.stringify(false)
                          );
                          setShowOnlyMyGroups(false);
                        } else {
                          localStorage.setItem("showAll", JSON.stringify(true));
                          setShowAll(true);
                        }

                        handleClose(e);
                      }}
                    >
                      {ticketsType === "groups"
                        ? "Todos los grupos"
                        : "Todos los tickets"}
                    </MenuItem>
                    <MenuItem
                      onClick={(e) => {
                        if (ticketsType === "groups") {
                          localStorage.setItem(
                            "showOnlyMyGroups",
                            JSON.stringify(true)
                          );
                          setShowOnlyMyGroups(true);
                        } else {
                          localStorage.setItem(
                            "showAll",
                            JSON.stringify(false)
                          );
                          setShowAll(false);
                        }
                        handleClose(e);
                      }}
                    >
                      {ticketsType === "groups"
                        ? "En los que participo"
                        : "Mis tickets"}
                    </MenuItem>
                  </Menu>
                </>
              )}
              no={() =>
                ticketsType === "groups" ? (
                  <>
                    <ArrowDropDownIcon
                      fontSize="medium"
                      onClick={handleClick}
                      style={{
                        cursor: "pointer",
                        scale: "1.5",
                      }}
                    />

                    <Menu
                      anchorEl={anchorEl}
                      open={Boolean(anchorEl)}
                      onClose={handleClose}
                    >
                      <MenuItem
                        onClick={(e) => {
                          if (ticketsType === "groups") {
                            localStorage.setItem(
                              "showOnlyMyGroups",
                              JSON.stringify(false)
                            );
                            setShowOnlyMyGroups(false);
                          }

                          handleClose(e);
                        }}
                      >
                        Todos los grupos
                      </MenuItem>
                      <MenuItem
                        onClick={(e) => {
                          if (ticketsType === "groups") {
                            localStorage.setItem(
                              "showOnlyMyGroups",
                              JSON.stringify(true)
                            );
                            setShowOnlyMyGroups(true);
                          }

                          handleClose(e);
                        }}
                      >
                        En los que participo
                      </MenuItem>
                    </Menu>
                  </>
                ) : null
              }
            />
          </>
        )}

        {ticketsType === "pendings" && (
          <>
            <div>PENDIENTES</div>
          </>
        )}

        {ticketsType === "no-category" && (
          <>
            <div>Sin Categoria</div>
          </>
        )}

        {category && (
          <>
            <div>{category.name}</div>
          </>
        )}

        {status === "closed" && <div>CERRADOS</div>}

        {onMoveToLeft && (
          <ArrowLeftIcon
            fontSize="medium"
            style={{
              cursor: "pointer",
              scale: "1.5",
              position: "absolute",
              left: "1rem",
            }}
            onClick={() => onMoveToLeft()}
          />
        )}

        {onMoveToRight && (
          <ArrowRightIcon
            fontSize="medium"
            style={{
              cursor: "pointer",
              scale: "1.5",
              position: "absolute",
              right: "1rem",
            }}
            onClick={() => onMoveToRight()}
          />
        )}
      </div>
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

export default TicketsList;
