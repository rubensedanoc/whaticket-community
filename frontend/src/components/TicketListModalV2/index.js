import React, { useEffect, useState } from "react";

import Dialog from "@material-ui/core/Dialog";

import Button from "@material-ui/core/Button";
import Paper from "@material-ui/core/Paper";
import TableContainer from "@material-ui/core/TableContainer";
import NewTicketModal from "../NewTicketModal";
import TicketListItem from "../TicketListItem";

import CircularProgress from "@material-ui/core/CircularProgress";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Typography from "@material-ui/core/Typography";
import api from "../../services/api";

const TicketListModalV2 = ({
  open,
  onClose,
  title,
  simpleTicketIds,
  structuredTicketIds,
  contactIdToCreateTicket,
}) => {
  const [loading, setLoading] = useState(false);
  const [simpleTicketList, setSimpleTicketList] = useState([]);
  const [structuredTicketList, setStructuredTicketList] = useState([]);
  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);

  useEffect(() => {
    console.log("TicketListModalV2 tickets ", {
      simpleTicketIds,
      structuredTicketIds,
    });

    const delayDebounceFn = setTimeout(async () => {
      if (simpleTicketIds || structuredTicketIds) {
        setLoading(true);

        const { data } = await api.get("/getATicketsList", {
          params: {
            ticketIds: JSON.stringify(
              structuredTicketIds
                ? structuredTicketIds.flatMap((obj) => obj.ids)
                : simpleTicketIds
            ),
          },
        });

        const ticketList = data.tickets;

        if (structuredTicketIds) {
          setStructuredTicketList(
            structuredTicketIds.map((IdsObj) => ({
              ...IdsObj,
              tickets: IdsObj.ids.map(
                (id) => ticketList.find((t) => t.id == id) || id
              ),
            }))
          );
        } else {
          setSimpleTicketList(ticketList);
        }
        setLoading(false);
      }
    }, 500);

    return () => {
      clearTimeout(delayDebounceFn);
      setSimpleTicketList([]);
      setStructuredTicketList([]);
    };
  }, [simpleTicketIds, structuredTicketIds]);

  const handleClose = () => {
    onClose();
  };

  return (
    <>
      <NewTicketModal
        preSelectedContactId={contactIdToCreateTicket}
        modalOpen={newTicketModalOpen}
        onClose={(e) => setNewTicketModalOpen(false)}
      />
      <Dialog open={open} onClose={handleClose} maxWidth="lg" scroll="paper">
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
          {!!simpleTicketList.length && (
            <TableContainer component={Paper}>
              {simpleTicketList.map((ticket) => (
                <div style={{ overflow: "hidden" }} key={ticket.id}>
                  <TicketListItem
                    ticket={ticket}
                    key={ticket.id}
                    openInANewWindowOnSelect={true}
                  />
                </div>
              ))}
            </TableContainer>
          )}

          {structuredTicketList.map((group) => (
            <div key={group.title} style={{ marginBottom: 16 }}>
              <Typography
                variant="h6"
                style={{ marginBottom: 8, fontWeight: "500" }}
              >
                {group.title}
              </Typography>

              <TableContainer component={Paper}>
                {group.tickets.map((ticket) => (
                  <div style={{ overflow: "hidden" }} key={ticket.id}>
                    <TicketListItem
                      ticket={ticket}
                      key={ticket.id}
                      openInANewWindowOnSelect={true}
                    />
                  </div>
                ))}
              </TableContainer>
            </div>
          ))}

          {!simpleTicketList.length && !structuredTicketList.length && (
            <TableContainer component={Paper}>
              <div style={{ textAlign: "center", padding: "20px" }}>
                Este contacto no tiene ningun ticket abierto
              </div>
            </TableContainer>
          )}

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

export default TicketListModalV2;
