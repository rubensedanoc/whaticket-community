import React, { useContext, useEffect, useState } from "react";
import { useHistory, useParams } from "react-router-dom";

import clsx from "clsx";
import { toast } from "react-toastify";
import openSocket from "../../services/socket-io";

import { Paper, makeStyles } from "@material-ui/core";

import { Button } from "@material-ui/core";
import TicketListModal from "../../components/TicketListModal";
import { ReplyMessageProvider } from "../../context/ReplyingMessage/ReplyingMessageContext";
import { SearchMessageContext } from "../../context/SearchMessage/SearchMessageContext";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import microserviceApi from "../../services/microserviceApi";
import ContactDrawer from "../ContactDrawer";
import TicketIaDrawer from "../TicketIaDrawer";
import MessageInput from "../MessageInput/";
import MessagesList from "../MessagesList";
import TicketActionButtons from "../TicketActionButtons";
import TicketCategories from "../TicketCategories";
import TicketHeader from "../TicketHeader";
import TicketInfo from "../TicketInfo";

import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import Select from "@material-ui/core/Select";
import Typography from "@material-ui/core/Typography";
import SaveIcon from '@material-ui/icons/Save';
import IconButton from '@material-ui/core/IconButton';
import InputAdornment from '@material-ui/core/InputAdornment';
import OutlinedInput from '@material-ui/core/OutlinedInput';
import "./styles.css";
import { getREACT_APP_PURPOSE } from "../../config";


const drawerWidth = 320;

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    height: "100%",
    position: "relative",
    overflow: "hidden",
  },

  ticketInfo: {
    maxWidth: "45%",
    overflow: "hidden",
    // flexBasis: "50%",
    // [theme.breakpoints.down("sm")]: {
    //   maxWidth: "80%",
    //   flexBasis: "80%",
    // },
  },
  ticketActionButtons: {
    // maxWidth: "50%",
    // flexBasis: "50%",
    display: "flex",
    [theme.breakpoints.down("sm")]: {
      // maxWidth: "100%",
      // flexBasis: "100%",
      marginBottom: "5px",
    },
  },

  mainWrapper: {
    flex: 1,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderLeft: "0",
    marginRight: -drawerWidth,
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  },

  mainWrapperShift: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
    marginRight: 0,
  },
}));

const Ticket = () => {
  const { ticketId } = useParams();
  const history = useHistory();
  const classes = useStyles();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [iaDrawerOpen, setIaDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState({});
  const [ticket, setTicket] = useState({});
  const [relatedTickets, setRelatedTickets] = useState([]);
  const [microServiceData, setMicroServiceData] = useState(null);
  const [selectRelatedTicketId, setSelectRelatedTicketId] = useState(null);
  const { setSearchingMessageId } = useContext(SearchMessageContext);
  const [ticketListModalOpen, setTicketListModalOpen] = useState(false);
  const [ticketListModalTitle, setTicketListModalTitle] = useState("");
  const [ticketListModalTickets, setTicketListModalTickets] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [marketingCampaigns, setMarketingCampaigns] = useState([]);
  const [selectMarketingCampaign, setSelectMarketingCampaign] = useState(0);
  const [clientelicenciaId, setClientelicenciaId] = useState(null);

  async function searchForMicroServiceData(contactNumber) {
    try {
      const { data: microserviceNumberData } = await microserviceApi.post(
        "/backendrestaurantpe/public/rest/common/contactobi/searchphone",
        {
          telefono: contactNumber,
        }
      );

      console.log("________TICKET microserviceData:", microserviceNumberData);

      setMicroServiceData(
        microserviceNumberData && microserviceNumberData.data?.length > 0
          ? microserviceNumberData.data
          : null
      );
    } catch (error) {
      console.log("________TICKET microserviceData error:", error);
    }
  }

  useEffect(() => {
    (async () => {
      const { data: marketingCampaigns } = await api.get("/marketingCampaigns");
      setMarketingCampaigns(marketingCampaigns);
    })();
  }, []);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchTicket = async () => {
        try {
          const { data } = await api.get("/tickets/" + ticketId);

          setContact(data.contact);
          setSelectMarketingCampaign(data.marketingCampaignId || 0);
          setTicket(data);

          // console.log("________ticket:", data);

          const { data: relatedTickets } = await api.get(
            "/showAllRelatedTickets/" + ticketId
          );

          console.log("________relatedTickets:", relatedTickets);

          setRelatedTickets(relatedTickets);
          setSelectRelatedTicketId(ticketId);

          setLoading(false);

          if (data.whatsappId === 11 && data.conversationIAEvalutaions?.length > 0) {
            setIaDrawerOpen(true);
          }

          await searchForMicroServiceData(data.contact?.number);
        } catch (err) {
          setLoading(false);
          toastError(err);
        }
      };
      fetchTicket();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [ticketId, history]);

  useEffect(() => {
    const socket = openSocket();

    socket.on("connect", () => socket.emit("joinChatBox", ticketId));

    socket.on("ticket", (data) => {
      if (data.action === "update") {
        setTicket(data.ticket);
        setSelectMarketingCampaign(data.ticket.marketingCampaignId || 0);
        console.log("ticker actulizado", data.ticket);
      }

      if (data.action === "delete") {
        toast.success("Ticket deleted sucessfully.");
        history.push("/tickets");
      }
    });

    socket.on("contact", (data) => {
      if (data.action === "update") {
        setContact((prevState) => {
          if (prevState.id === data.contact?.id) {
            searchForMicroServiceData(data.contact?.number);
            return { ...prevState, ...data.contact };
          }
          return prevState;
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [ticketId, history]);

  const handleDrawerOpen = () => {
    setDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
  };

  const onSeeMoreTicketsClickHandler = async () => {
    try {
      const { data: contactTicketSummary } = await api.post(
        "/contacts/getContactTicketSummary",
        {
          contactId: contact.id,
          onlyIds: true,
        }
      );

      setSelectedContactId(contact.id);
      setTicketListModalTitle("Todos los tickets de " + contact.name);
      setTicketListModalOpen(true);
      setTicketListModalTickets(contactTicketSummary?.map((t) => t.id) || []);
    } catch (error) {
      console.log(error);
      toastError(error);
    }
  };

  const saveClientelicenciaId = async () => {
    try {
      await api.put(`/contacts/${ticket.contact?.id}`, {
        traza_clientelicencia_id: clientelicenciaId || null,
      });
      toast.success("Clientelicencia ID actualizado correctamente.");
    } catch (err) {
      console.log(err);
      toastError(err);
    }
  };

  const removeClientelicencia = async (traza_clientelicencia_id) => {
    try {
      await api.put(`/contacts/removeClientelicencia/${ticket.contact?.id}`, {
        traza_clientelicencia_id: traza_clientelicencia_id,
      });
      toast.success("Clientelicencia ID eliminado correctamente.");
    } catch (err) {
      console.log(err);
      toastError(err);
    }
  };

  return (
    <div className={classes.root} id="drawer-container">
      <TicketIaDrawer
        open={iaDrawerOpen}
        contact={contact}
        ticketId={ticketId}
        loading={loading}
        microServiceData={microServiceData}
        ticket={ticket}
      />
      <Paper
        variant="outlined"
        elevation={0}
        className={clsx(classes.mainWrapper, {
          [classes.mainWrapperShift]: drawerOpen,
        })}
      >
        <TicketHeader withArrow={false} loading={loading}>
          <div className={classes.ticketInfo}>
            <TicketInfo
              contact={contact}
              ticket={ticket}
              onClick={handleDrawerOpen}
              microServiceData={microServiceData}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            {contact?.contactClientelicencias?.length ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                Licencias: 
                <Typography color="primary">
                  {
                    contact.contactClientelicencias.map(
                      (ccl) => {
                        return (
                          <div key={ccl.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div>
                              {ccl.traza_clientelicencia_id}
                            </div>
                            <div style={{ cursor: "pointer", color: "red" }} onClick={() => removeClientelicencia(ccl.traza_clientelicencia_id)}>
                              x
                            </div>
                          </div>
                        );
                      }
                    )
                  }
                </Typography>
              </div>
            ) : null}

            <FormControl margin="dense" variant="outlined">
              <InputLabel>Ticket</InputLabel>
              <Select
                labelWidth={60}
                onChange={(e) => {
                  console.log(
                    e.target.value,
                    relatedTickets.find((rt) => rt.id === e.target.value)
                  );
                  setSelectRelatedTicketId(e.target.value);
                  setSearchingMessageId(
                    relatedTickets.find((rt) => rt.id === e.target.value)
                      ?.messages[0]?.id
                  );
                }}
                value={selectRelatedTicketId}
                MenuProps={{
                  anchorOrigin: {
                    vertical: "bottom",
                    horizontal: "left",
                  },
                  transformOrigin: {
                    vertical: "top",
                    horizontal: "left",
                  },
                  getContentAnchorEl: null,
                }}
              >
                {relatedTickets.map((rt) => (
                  <MenuItem key={rt.id} value={rt.id}>
                    {rt.id}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* <Button
              size="small"
              variant="text"
              color="primary"
              onClick={onSeeMoreTicketsClickHandler}
            >
              Ver más tickets
            </Button> */}
          </div>

          <div className={classes.ticketActionButtons}>
            <TicketActionButtons ticket={ticket} />
          </div>
        </TicketHeader>

        <div style={{ display: "flex", height: "2.5rem" }}>
          <div style={{ flexGrow: "1" }}>
            <TicketCategories ticket={ticket} />
          </div>

          {getREACT_APP_PURPOSE() !== "comercial" && (
            <FormControl style={{ flexGrow: "1" }} id="input-clientelicencia_id">
              <OutlinedInput
                type='number'
                placeholder="Clientelicencia ID"
                value={clientelicenciaId}
                onChange={(event)=>{
                  setClientelicenciaId(event.target.value)
                }}
                endAdornment={
                  <InputAdornment position="end">
                    <IconButton
                      onClick={()=>{
                        saveClientelicenciaId()
                      }}
                    >
                      <SaveIcon />
                    </IconButton>
                  </InputAdornment>
                }
              />
            </FormControl>
          )}

          {getREACT_APP_PURPOSE() === "comercial" && (
            <div style={{ flexGrow: "1" }}>
              <Select
                style={{ height: "100%", padding: "0 16px" }}
                onChange={async (e) => {
                  try {
                    await api.put(`/tickets/${ticket.id}`, {
                      marketingCampaignId:
                        e.target.value === 0 ? null : e.target.value,
                    });

                    toast.success(
                      "Campaña de marketing actualizada correctamente."
                    );
                  } catch (err) {
                    console.log(err);
                    toastError(err);
                  }

                  setSelectMarketingCampaign(e.target.value);
                }}
                fullWidth
                value={selectMarketingCampaign}
                MenuProps={{
                  anchorOrigin: {
                    vertical: "bottom",
                    horizontal: "left",
                  },
                  transformOrigin: {
                    vertical: "top",
                    horizontal: "left",
                  },
                  getContentAnchorEl: null,
                }}
              >
                <MenuItem value={0}>Sin campaña</MenuItem>
                {marketingCampaigns.map((mc) => (
                  <MenuItem key={mc.id} value={mc.id}>
                    {mc.name}
                  </MenuItem>
                ))}
              </Select>
            </div>
          )}
        </div>

        <ReplyMessageProvider>
          <MessagesList
            ticketId={ticketId}
            isGroup={ticket.isGroup}
          ></MessagesList>
          {ticket.status === "open" && (
            <MessageInput
              ticketIsGroup={ticket.isGroup}
              ticketStatus={ticket.status}
              ticketPrivateNote={ticket.privateNote}
            />
          )}
        </ReplyMessageProvider>
      </Paper>

      <ContactDrawer
        open={drawerOpen}
        handleDrawerClose={handleDrawerClose}
        contact={contact}
        ticketId={ticketId}
        loading={loading}
        microServiceData={microServiceData}
      />
      <TicketListModal
        modalOpen={ticketListModalOpen}
        title={ticketListModalTitle}
        tickets={ticketListModalTickets}
        preSelectedContactId={selectedContactId}
        orderTicketsAsOriginalOrder={true}
        newView={true}
        onClose={() => setTicketListModalOpen(false)}
      />
    </div>
  );
};

export default Ticket;
