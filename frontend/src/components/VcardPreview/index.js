import Avatar from "@material-ui/core/Avatar";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import React, { useContext, useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import TicketListModal from "../../components/TicketListModal";
import toastError from "../../errors/toastError";
import api from "../../services/api";

import { AuthContext } from "../../context/Auth/AuthContext";

import { Button, Divider } from "@material-ui/core";

const VcardPreview = ({ contact, numbers }) => {
  const history = useHistory();
  const { user } = useContext(AuthContext);
  const [ticketListModalOpen, setTicketListModalOpen] = useState(false);
  const [ticketListModalTitle, setTicketListModalTitle] = useState("");
  const [ticketListModalTickets, setTicketListModalTickets] = useState([]);

  const [selectedContact, setContact] = useState({
    name: "",
    number: 0,
    profilePicUrl: "",
  });

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      const fetchContacts = async () => {
        try {
          let contactObj = {
            name: contact,
            // number: numbers.replace(/\D/g, ""),
            number: numbers !== undefined && numbers.replace(/\D/g, ""),
            email: "",
          };
          const { data } = await api.post("/contact", contactObj);
          setContact(data);
        } catch (err) {
          console.log(err);
          toastError(err);
        }
      };
      fetchContacts();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [contact, numbers]);

  const handleNewChat = async () => {
    try {
      const { data } = await api.get(
        "/contacts-showWithActualTickets/" + selectedContact.id
      );

      setTicketListModalTitle("Tickets de " + selectedContact.name);
      setTicketListModalOpen(true);
      setTicketListModalTickets(data.tickets?.map((t) => t.id) || []);
    } catch (err) {
      console.error(err);
      toastError("Error al encontrar tickets actuales del contacto");
    }
  };

  return (
    <>
      <div
        style={{
          minWidth: "250px",
        }}
      >
        <Grid container spacing={1}>
          <Grid item xs={2}>
            <Avatar src={selectedContact.profilePicUrl} />
          </Grid>
          <Grid item xs={9}>
            <Typography
              style={{ marginTop: "12px", marginLeft: "10px" }}
              variant="subtitle1"
              color="primary"
              gutterBottom
            >
              {selectedContact.name}
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <Divider />
            <Button
              fullWidth
              color="primary"
              onClick={handleNewChat}
              disabled={!selectedContact.number}
            >
              Conversar
            </Button>
            <TicketListModal
              preSelectedContactId={selectedContact.id}
              modalOpen={ticketListModalOpen}
              onClose={() => setTicketListModalOpen(false)}
              title={ticketListModalTitle}
              tickets={ticketListModalTickets}
              newView={true}
            />
          </Grid>
        </Grid>
      </div>
    </>
  );
};

export default VcardPreview;
