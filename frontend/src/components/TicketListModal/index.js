import React, { useContext, useEffect, useState } from "react";

import Dialog from "@material-ui/core/Dialog";

import Button from "@material-ui/core/Button";
import Paper from "@material-ui/core/Paper";
import TableContainer from "@material-ui/core/TableContainer";
import NewTicketModal from "../NewTicketModal";
import TicketListItem from "../TicketListItem";

import CircularProgress from "@material-ui/core/CircularProgress";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import { makeStyles } from "@material-ui/core/styles";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import api from "../../services/api";

const useRowStyles = makeStyles({
  root: {
    "& > *": {
      borderBottom: "unset",
    },
  },
  collapseColumn: {
    width: 40, // Ajusta este valor según tus necesidades
  },
});

const TicketListModal = ({ modalOpen, onClose, title, tickets, newView }) => {
  const [loading, setLoading] = useState(false);
  const [ticketsData, setTicketsData] = useState([]);
  const { whatsApps } = useContext(WhatsAppsContext);
  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);

  useEffect(() => {
    console.log("tickets", tickets);

    const delayDebounceFn = setTimeout(async () => {
      if (tickets.length > 0) {
        setLoading(true);

        // await new Promise((resolve) => setTimeout(resolve, 5000));

        const { data } = await api.get("/getATicketsList", {
          params: {
            ticketIds: JSON.stringify(
              newView ? tickets : tickets.map((ticket) => ticket.id)
            ),
          },
        });
        console.log("tickets data", data.tickets);
        // console.log(
        //   "ticketsWithClientTimeWaiting: ",
        //   data.tickets.map((t) => ({
        //     id: t.id,
        //     clientTimeWaiting: t.clientTimeWaiting,
        //   }))
        // );

        setTicketsData(data.tickets);
        setLoading(false);
      }
    }, 500);

    return () => {
      clearTimeout(delayDebounceFn);
      setTicketsData([]);
    };
  }, [tickets]);

  const handleClose = () => {
    onClose();
  };

  return (
    <>
      <NewTicketModal
        modalOpen={newTicketModalOpen}
        onClose={(e) => setNewTicketModalOpen(false)}
      />
      <Dialog
        open={modalOpen}
        onClose={handleClose}
        maxWidth="lg"
        scroll="paper"
      >
        <DialogTitle id="form-dialog-title">
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            {title}
            <Button
              variant="outlined"
              color="primary"
              onClick={() => setNewTicketModalOpen(true)}
            >
              Crear ticket
            </Button>
          </div>
        </DialogTitle>
        <DialogContent dividers style={{ width: "900px" }}>
          <TableContainer component={Paper}>
            {ticketsData.length ? (
              ticketsData
                .sort((a, b) => {
                  if (a.clientTimeWaiting > b.clientTimeWaiting) {
                    return 1;
                  }
                  if (a.clientTimeWaiting < b.clientTimeWaiting) {
                    return -1;
                  }
                  return 0;
                })
                .map((ticket) => (
                  <div style={{ overflow: "hidden" }} key={ticket.id}>
                    <TicketListItem
                      ticket={ticket}
                      key={ticket.id}
                      openInANewWindowOnSelect={true}
                    />
                  </div>
                ))
            ) : (
              <div style={{ textAlign: "center", padding: "20px" }}>
                Este contacto no tiene ningun ticket abierto
              </div>
            )}
          </TableContainer>
          {loading && (
            <CircularProgress
              color="primary"
              size={50}
              style={{
                marginLeft: "auto",
                marginRight: "auto",
                display: "block",
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TicketListModal;
