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
import { toast } from "react-toastify";
import api from "../../services/api";
import { NumberGroups } from "../NumberGroupsModal";

const TicketListModal = ({
  preSelectedContactId,
  modalOpen,
  onClose,
  title,
  tickets,
  newView,
  orderTicketsAsOriginalOrder = false,
  divideByProperty = false,
  divideByPropertyNullValue = "divideByPropertyNullValue",
}) => {
  const [loading, setLoading] = useState(false);
  const [ticketsData, setTicketsData] = useState([]);
  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
  const [numberGroups, setNumberGroups] = useState([]);

  useEffect(() => {
    console.log("TicketListModal tickets", tickets);

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

        if (orderTicketsAsOriginalOrder) {
          // Crear un objeto para mapear los IDs a sus índices
          const ticketsOrderObject = {};
          tickets.forEach((id, index) => {
            ticketsOrderObject[id] = index;
          });

          // Ordenar los datos en base al array original de IDs
          data.tickets.sort((a, b) => {
            return ticketsOrderObject[a.id] - ticketsOrderObject[b.id];
          });
        }

        setTicketsData(data.tickets);

        if (preSelectedContactId) {
          try {
            const { data } = await api.get(
              `/getNumberGroupsByContactId/${preSelectedContactId}`
            );
            setNumberGroups(data.registerGroups);
          } catch (err) {
            console.log("err", err);
            toast.error("No se pudieron recuperar los grupos del contacto");
          }
        }

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
        preSelectedContactId={preSelectedContactId}
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
          {ticketsData.length ? (
            divideByProperty ? (
              (() => {
                const ticketsDataDivided = {};
                const propertyFomat = divideByProperty.split(".");

                ticketsData.forEach((ticket) => {
                  let value = ticket;

                  propertyFomat.forEach((property) => {
                    if (value[property]) {
                      value = value[property];
                    } else {
                      value = divideByPropertyNullValue;
                    }
                  });

                  if (!ticketsDataDivided[value]) {
                    ticketsDataDivided[value] = [ticket];
                  } else {
                    ticketsDataDivided[value].push(ticket);
                  }
                });

                return Object.keys(ticketsDataDivided).map((key) => (
                  <div key={key} style={{ marginBottom: 16 }}>
                    <Typography
                      variant="h6"
                      style={{ marginBottom: 8, fontWeight: "500" }}
                    >
                      {key}
                    </Typography>

                    <TableContainer component={Paper}>
                      {ticketsDataDivided[key]
                        .sort((a, b) => {
                          if (
                            a.beenWaitingSinceTimestamp >
                            b.beenWaitingSinceTimestamp
                          ) {
                            return 1;
                          }
                          if (
                            a.beenWaitingSinceTimestamp <
                            b.beenWaitingSinceTimestamp
                          ) {
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
                        ))}
                    </TableContainer>
                  </div>
                ));
              })()
            ) : (
              <TableContainer component={Paper}>
                {ticketsData
                  .sort((a, b) => {
                    if (
                      a.beenWaitingSinceTimestamp > b.beenWaitingSinceTimestamp
                    ) {
                      return 1;
                    }
                    if (
                      a.beenWaitingSinceTimestamp < b.beenWaitingSinceTimestamp
                    ) {
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
                  ))}
              </TableContainer>
            )
          ) : (
            <TableContainer component={Paper}>
              <div style={{ textAlign: "center", padding: "20px" }}>
                Este contacto no tiene ningun ticket abierto
              </div>
            </TableContainer>
          )}

          {preSelectedContactId && numberGroups.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Typography
                variant="h6"
                style={{ marginBottom: 8, fontWeight: "500" }}
              >
                Grupos de número
              </Typography>

              <TableContainer>
                <NumberGroups groups={numberGroups} />
              </TableContainer>
            </div>
          )}
          {preSelectedContactId && numberGroups.length === 0 && (
            <div style={{ textAlign: "center", padding: "20px" }}>
              No encontramos grupos para este grupo
            </div>
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

export default TicketListModal;
