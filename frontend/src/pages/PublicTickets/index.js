import Grid from "@material-ui/core/Grid";
// import Paper from "@material-ui/core/Paper";
import { makeStyles } from "@material-ui/core/styles";
import React, { useEffect, useState } from "react";
import api from "../../services/api";

import { toast } from "react-toastify";

import { useLocation } from "react-router-dom";
import PublicMessagesList from "../../components/PublicMessagesList";

// import Ticket from "../../components/Ticket/";

// import Hidden from "@material-ui/core/Hidden";

// import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  chatContainer: {
    flex: 1,
    // // backgroundColor: "#eee",
    // padding: theme.spacing(4),
    height: `calc(100% - 48px)`,
    overflowY: "hidden",
  },

  chatPapper: {
    // backgroundColor: "red",
    display: "flex",
    height: "100%",
  },

  contactsWrapper: {
    display: "flex",
    height: "100%",
    flexDirection: "column",
    overflowY: "hidden",
  },
  contactsWrapperSmall: {
    display: "flex",
    height: "100%",
    flexDirection: "column",
    overflowY: "hidden",
    [theme.breakpoints.down("sm")]: {
      display: "none",
    },
  },
  messagessWrapper: {
    display: "flex",
    height: "100%",
    flexDirection: "column",
  },
  welcomeMsg: {
    backgroundColor: "#eee",
    display: "flex",
    justifyContent: "space-evenly",
    alignItems: "center",
    height: "100%",
    textAlign: "center",
    borderRadius: 0,
  },
  ticketsManager: {},
  ticketsManagerClosed: {
    [theme.breakpoints.down("sm")]: {
      display: "none",
    },
  },
}));

const PublicTickets = () => {
  const classes = useStyles();
  const location = useLocation();

  const [allMessages, setAllMessages] = useState([]);
  const [messagesContact, setMessagesContact] = useState(null);
  const [allWhatsapps, setAllWhatsapps] = useState([]);

  useEffect(() => {
    (async () => {
      const searchParams = new URLSearchParams(location.search);

      // aObtener los valores de los parámetros
      const whatsappId = searchParams.get("whatsappId"); // "1"
      const contactId = searchParams.get("contactId"); // "2"

      console.log({
        whatsappId,
        contactId,
      });

      try {
        const { data } = await api.post(`/messagesAll`, {
          whatsappId: +whatsappId,
          contactId: +contactId,
        });

        console.log(data);

        const { ticketMessages, contact, allWhatsapps } = data;

        console.log(1);

        setAllMessages(ticketMessages);
        console.log(2);
        setMessagesContact(contact);
        console.log(3);
        setAllWhatsapps(allWhatsapps);
        console.log(4);
      } catch (err) {
        toast.error(err);
      }
    })();
  }, [location]);

  return (
    <div className={classes.chatContainer}>
      <div className={classes.chatPapper}>
        <Grid container spacing={0}>
          {allMessages.length && (
            <PublicMessagesList
              messagesList={allMessages}
              isGroup={messagesContact?.isGroup}
              whatsApps={allWhatsapps}
            />
          )}
        </Grid>
      </div>
    </div>
  );
};

export default PublicTickets;
