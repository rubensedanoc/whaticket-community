import React, { useEffect, useReducer, useState } from "react";

import openSocket from "../../services/socket-io";

import {
  Button,
  IconButton,
  makeStyles,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@material-ui/core";
import ButtonWithSpinner from "../../components/ButtonWithSpinner";

import { DeleteOutline, Edit } from "@material-ui/icons";
import { toast } from "react-toastify";
import ConfirmationModal from "../../components/ConfirmationModal";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import MessagingCampaignModal from "../../components/MessagingCampaignModal";
import SendMessagingCampaign from "../../components/SendMessagingCampaign";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import Title from "../../components/Title";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
  customTableCell: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
}));

const reducer = (state, action) => {
  if (action.type === "LOAD_CATEGORIES") {
    const categories = action.payload;
    const newCategories = [];

    categories.forEach((messagingCampaign) => {
      const messagingCampaignIndex = state.findIndex(
        (q) => q.id === messagingCampaign.id
      );
      if (messagingCampaignIndex !== -1) {
        state[messagingCampaignIndex] = messagingCampaign;
      } else {
        newCategories.push(messagingCampaign);
      }
    });

    return [...state, ...newCategories];
  }

  if (action.type === "UPDATE_CATEGORIES") {
    const messagingCampaign = action.payload;
    const messagingCampaignIndex = state.findIndex(
      (u) => u.id === messagingCampaign.id
    );

    if (messagingCampaignIndex !== -1) {
      state[messagingCampaignIndex] = messagingCampaign;
      return [...state];
    } else {
      return [messagingCampaign, ...state];
    }
  }

  if (action.type === "DELETE_CATEGORY") {
    const messagingCampaignId = action.payload;
    const messagingCampaignIndex = state.findIndex(
      (q) => q.id === messagingCampaignId
    );
    if (messagingCampaignIndex !== -1) {
      state.splice(messagingCampaignIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const MessagingCampaigns = () => {
  const classes = useStyles();

  const [messagingCampaigns, dispatch] = useReducer(reducer, []);
  const [loading, setLoading] = useState(false);

  const [messagingCampaignModalOpen, setMessagingCampaignModalOpen] =
    useState(false);
  const [selectedMessagingCampaign, setSelectedMessagingCampaign] =
    useState(null);

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmModalTitle, setConfirmModalTitle] = useState("");
  const [confirmModalHandler, setConfirmModalHandler] = useState(
    () => () => {}
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/messagingCampaigns");
        dispatch({ type: "LOAD_CATEGORIES", payload: data });

        setLoading(false);
      } catch (err) {
        toastError(err);
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const socket = openSocket();

    socket.on("messagingCampaign", (data) => {
      console.log("socket.on messagingCampaign", data);

      if (data.action === "update" || data.action === "create") {
        dispatch({
          type: "UPDATE_CATEGORIES",
          payload: data.messagingCampaign,
        });
      }

      if (data.action === "delete") {
        dispatch({
          type: "DELETE_CATEGORY",
          payload: data.messagingCampaignId,
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleOpenMessagingCampaignModal = () => {
    setMessagingCampaignModalOpen(true);
    setSelectedMessagingCampaign(null);
  };

  const handleCloseMessagingCampaignModal = () => {
    setMessagingCampaignModalOpen(false);
    setSelectedMessagingCampaign(null);
  };

  const handleEditMessagingCampaign = (messagingCampaign) => {
    setSelectedMessagingCampaign(messagingCampaign);
    setMessagingCampaignModalOpen(true);
  };

  const [sendMessagingCampaignOpen, setSendMessagingCampaignOpen] =
    useState(false);

  const handleDeleteMessagingCampaign = async (messagingCampaignId) => {
    try {
      await api.delete(`/messagingCampaigns/${messagingCampaignId}`);
      toast.success(i18n.t("MessagingCampaign deleted successfully!"));
    } catch (err) {
      toastError(err);
    }
    setSelectedMessagingCampaign(null);
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={confirmModalTitle}
        open={confirmModalOpen}
        onClose={() => {
          setConfirmModalOpen(false);
          setConfirmModalTitle("");
          setConfirmModalHandler(() => () => {});
        }}
        onConfirm={() => confirmModalHandler()}
      >
        {i18n.t("categories.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      <MessagingCampaignModal
        open={messagingCampaignModalOpen}
        onClose={handleCloseMessagingCampaignModal}
        messagingCampaignId={selectedMessagingCampaign?.id}
      />
      <SendMessagingCampaign
        open={sendMessagingCampaignOpen}
        onClose={() => {
          setSendMessagingCampaignOpen(false);
        }}
        messagingCampaignId={selectedMessagingCampaign?.id}
      />
      <div style={{ padding: "2rem", height: "85%" }}>
        <MainHeader>
          <Title>Campañas de mensajes</Title>
          <MainHeaderButtonsWrapper>
            <Button
              variant="contained"
              color="primary"
              onClick={handleOpenMessagingCampaignModal}
            >
              Agregar Campaña
            </Button>
          </MainHeaderButtonsWrapper>
        </MainHeader>
        <Paper className={classes.mainPaper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell align="center">Nombre</TableCell>
                <TableCell align="center">Veces enviada</TableCell>
                <TableCell align="center">Estado de ultima enviada</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <>
                {messagingCampaigns?.map((messagingCampaign) => (
                  <TableRow key={messagingCampaign.id}>
                    <TableCell align="center">
                      {messagingCampaign.name}
                    </TableCell>
                    <TableCell align="center">
                      {messagingCampaign.timesSent}
                    </TableCell>
                    <TableCell align="center">
                      <span
                        style={{
                          color:
                            messagingCampaign.messagingCampaignShipments?.[0]
                              ?.status === "sent"
                              ? "green"
                              : messagingCampaign
                                  .messagingCampaignShipments?.[0]?.status ===
                                "sending"
                              ? "red"
                              : "gray",
                        }}
                      >
                        {messagingCampaign.messagingCampaignShipments?.[0]
                          ?.status || "Nunca enviada"}
                      </span>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() =>
                          handleEditMessagingCampaign(messagingCampaign)
                        }
                      >
                        <Edit />
                      </IconButton>

                      <IconButton
                        size="small"
                        onClick={() => {
                          // setSelectedMessagingCampaign(messagingCampaign);
                          setConfirmModalOpen(true);
                          setConfirmModalTitle(
                            `${i18n.t(
                              "categories.confirmationModal.deleteTitle"
                            )} ${messagingCampaign.name}?`
                          );
                          setConfirmModalHandler(
                            () => () =>
                              handleDeleteMessagingCampaign(
                                messagingCampaign.id
                              )
                          );
                        }}
                      >
                        <DeleteOutline />
                      </IconButton>

                      {messagingCampaign.messagingCampaignShipments?.[0]
                        ?.status === "sending" ? (
                        <ButtonWithSpinner
                          variant="contained"
                          type="submit"
                          color="primary"
                          loading={false}
                          onClick={() => {
                            setConfirmModalOpen(true);
                            setConfirmModalTitle(
                              `Estas seguro de querer cancelar el ultimo envio de ${messagingCampaign.name}?`
                            );
                            setConfirmModalHandler(() => () => {
                              api.post("/messagingCampaigns/cancel", {
                                messagingCampaignId: messagingCampaign.id,
                              });
                            });
                          }}
                        >
                          Cancelar Envio
                        </ButtonWithSpinner>
                      ) : (
                        <ButtonWithSpinner
                          variant="contained"
                          type="submit"
                          color="primary"
                          loading={false}
                          onClick={() => {
                            setSendMessagingCampaignOpen(true);
                            setSelectedMessagingCampaign(messagingCampaign);
                          }}
                        >
                          Enviar
                        </ButtonWithSpinner>
                      )}

                      {/* <ButtonWithSpinner
                        variant="contained"
                        type="submit"
                        color="primary"
                        loading={false}
                        onClick={() => {
                          setSendMessagingCampaignOpen(true);
                          setSelectedMessagingCampaign(messagingCampaign);
                        }}
                      >
                        Enviar
                      </ButtonWithSpinner> */}
                    </TableCell>
                  </TableRow>
                ))}
                {loading && <TableRowSkeleton columns={4} />}
              </>
            </TableBody>
          </Table>
        </Paper>
      </div>
    </MainContainer>
  );
};

export default MessagingCampaigns;
