import { format } from "date-fns";
import React, { useEffect, useReducer, useState } from "react";
import openSocket from "../../services/socket-io";

import {
  Button,
  Checkbox,
  IconButton,
  ListItemText,
  makeStyles,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@material-ui/core";
import Badge from "@material-ui/core/Badge";
import Container from "@material-ui/core/Container";
import FormControl from "@material-ui/core/FormControl";
import MenuItem from "@material-ui/core/MenuItem";
import Select from "@material-ui/core/Select";
import TextField from "@material-ui/core/TextField";
import { DeleteOutline, Edit } from "@material-ui/icons";
import ButtonWithSpinner from "../../components/ButtonWithSpinner";
import ChatbotMessageModal from "../../components/ChatbotMessageModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";

import * as XLSX from "xlsx";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import Title from "../../components/Title";
import toastError from "../../errors/toastError";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
  container: {
    paddingTop: theme.spacing(4),
    paddingBottom: theme.spacing(4),
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
  },
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
  if (action.type === "LOAD_MESSAGES") {
    console.log("LOAD_MESSAGES", action.payload);

    const messages = action.payload;
    const newMessages = [];

    messages.forEach((message) => {
      const messageIndex = state.findIndex((m) => m.id === message.id);
      if (messageIndex !== -1) {
        state[messageIndex] = message;
      } else {
        newMessages.push(message);
      }
    });

    return [...state, ...newMessages];
  }

  if (action.type === "UPDATE_MESSAGE") {
    console.log("UPDATE_MESSAGE", action.payload);

    const message = action.payload;
    const messageIndex = state.findIndex((u) => u.id === message.id);

    if (messageIndex !== -1) {
      state[messageIndex] = message;
      return [...state];
    } else {
      return [message, ...state];
    }
  }

  if (action.type === "DELETE_MESSAGE") {
    console.log("DELETE_MESSAGE", action.payload);

    const messageId = action.payload;
    const messageIndex = state.findIndex((q) => q.id === messageId);
    if (messageIndex !== -1) {
      state.splice(messageIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const ApiChatbot = () => {
  const classes = useStyles();

  const [chatbotMessages, dispatch] = useReducer(reducer, []);
  const [loading, setLoading] = useState(false);

  const [chatbotMessageModalOpen, setChatbotMessageModalOpen] = useState(false);
  const [selectedChatbotMessage, setSelectedChatbotMessage] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [selectedMessagesIds, setSelectedMessagesIds] = useState([]);
  const [fromDate, setFromDate] = useState(
    format(new Date(), "yyyy-MM-dd") + " 00:00:00"
  );
  const [toDate, setToDate] = useState(
    format(new Date(), "yyyy-MM-dd") + " 23:59:59"
  );
  const [loadingReportHistory, setLoadingReportHistory] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/chatbotMessages?onlyFathers=1");
        dispatch({ type: "LOAD_MESSAGES", payload: data.chatbotMessages });
        setSelectedMessagesIds(data.chatbotMessages.map((m) => m.identifier));
        setLoading(false);
      } catch (err) {
        toastError(err);
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const socket = openSocket();

    socket.on("chatbotMessage", (data) => {
      console.log("chatbotMessage", data);

      if (data.action === "update" || data.action === "create") {
        if (!data.chatbotMessage.fatherChatbotOptionId) {
          dispatch({ type: "UPDATE_MESSAGE", payload: data.chatbotMessage });
        }
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_MESSAGE", payload: data.chatbotMessageId });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleOpenChatbotMessageModal = () => {
    setChatbotMessageModalOpen(true);
    setSelectedChatbotMessage(null);
  };

  const handleCloseChatbotMessageModal = () => {
    setChatbotMessageModalOpen(false);
    setSelectedChatbotMessage(null);
  };

  const handleEditChatbotMessage = (queue) => {
    setSelectedChatbotMessage(queue);
    setChatbotMessageModalOpen(true);
  };

  const handleCloseConfirmationModal = () => {
    setConfirmModalOpen(false);
    setSelectedChatbotMessage(null);
  };

  const handleDeleteChatbotMessage = async (chatbotMessageId) => {
    try {
      await api.delete(`/chatbotMessage/${chatbotMessageId}`);
      console.log("ChatbotMessage deleted successfully!");
    } catch (err) {
      toastError(err);
    }
    setSelectedChatbotMessage(null);
  };

  const getReport = async () => {
    setLoadingReportHistory(true);
    try {
      const { data: reportToExcel } = await api.get(
        "/chatbotMessagesReportToExcel",
        {
          params: {
            fromDate: format(new Date(fromDate), "yyyy-MM-dd'T'HH:mm:ssXXX"),
            toDate: format(new Date(toDate), "yyyy-MM-dd'T'HH:mm:ssXXX"),
            selectedChatbotMessagesIds: JSON.stringify(selectedMessagesIds),
          },
        }
      );

      if (reportToExcel) {
        const dataToExport = reportToExcel.ticketList.map((row) => {
          const { microserviceData, ...rowData } = row;

          return {
            ...rowData,
            ...microserviceData,
          };
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
        XLSX.writeFile(workbook, `${"WHATREST"}.xlsx`);
      }
    } catch (err) {
      console.error(err);
      toastError(err);
    }
    setLoadingReportHistory(false);
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={
          selectedChatbotMessage &&
          `Estas seguro de borrar ${selectedChatbotMessage.identifier}?`
        }
        open={confirmModalOpen}
        onClose={handleCloseConfirmationModal}
        onConfirm={() => handleDeleteChatbotMessage(selectedChatbotMessage.id)}
      >
        NO BORRAR SI YA ESTABA EN FUNCIONAMIENTO SIN AVISAR A UN PROGRAMADOR!!
      </ConfirmationModal>

      <ChatbotMessageModal
        open={chatbotMessageModalOpen}
        onClose={handleCloseChatbotMessageModal}
        chatbotMessageId={selectedChatbotMessage?.id}
      />

      <div style={{ padding: "2rem" }}>
        <MainHeader>
          <Title>Api Chatbot - Mensajes Programados</Title>
          <MainHeaderButtonsWrapper>
            <Button
              variant="contained"
              color="primary"
              onClick={handleOpenChatbotMessageModal}
            >
              Crear mensaje programdo
            </Button>
          </MainHeaderButtonsWrapper>
        </MainHeader>
        <Paper className={classes.mainPaper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell align="center">Identificador</TableCell>
                <TableCell align="center">Tipo</TableCell>
                {/* <TableCell align="center">Titulo</TableCell> */}
                <TableCell align="center">Tiene opciones</TableCell>
                <TableCell align="center">Activo</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <>
                {chatbotMessages.map((chatbotMessage) => (
                  <TableRow key={chatbotMessage.id}>
                    <TableCell align="center">
                      {chatbotMessage.identifier}
                    </TableCell>
                    <TableCell align="center">
                      {chatbotMessage.mediaType}
                    </TableCell>
                    {/* <TableCell align="center">{chatbotMessage.title}</TableCell> */}
                    <TableCell align="center">
                      {chatbotMessage.hasSubOptions ? (
                        <span style={{ color: "green" }}>Sí</span>
                      ) : (
                        <span style={{ color: "red" }}>No</span>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {chatbotMessage.isActive ? (
                        <span style={{ color: "green" }}>Sí</span>
                      ) : (
                        <span style={{ color: "red" }}>No</span>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => handleEditChatbotMessage(chatbotMessage)}
                      >
                        <Edit />
                      </IconButton>

                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedChatbotMessage(chatbotMessage);
                          setConfirmModalOpen(true);
                        }}
                      >
                        <DeleteOutline />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {loading && <TableRowSkeleton columns={4} />}
              </>
            </TableBody>
          </Table>
        </Paper>
        <Container maxWidth="lg" className={classes.container}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              width: "100%",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex" }}>
              <Title>Reportes</Title>
              <div
                style={{
                  marginLeft: "2.5rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                }}
              >
                <TextField
                  id="date"
                  label="Desde"
                  type="datetime-local"
                  variant="outlined"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className={classes.textField}
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
                <TextField
                  id="date"
                  label="Hasta"
                  type="datetime-local"
                  variant="outlined"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className={classes.textField}
                  InputLabelProps={{
                    shrink: true,
                  }}
                />

                <Badge
                  overlap="rectangular"
                  badgeContent={selectedMessagesIds.length}
                  color="primary"
                  max={99999}
                  invisible={selectedMessagesIds.length === 0}
                >
                  <FormControl fullWidth margin="dense">
                    <Select
                      multiple
                      displayEmpty
                      autoWidth
                      variant="outlined"
                      value={selectedMessagesIds}
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
                      renderValue={() => "Mensajes Programados"}
                    >
                      {chatbotMessages?.length > 0 &&
                        chatbotMessages.map((chatbotMessage) => (
                          <MenuItem
                            dense
                            key={chatbotMessage.id}
                            value={chatbotMessage.id}
                          >
                            <Checkbox
                              style={{
                                color: "black",
                              }}
                              size="small"
                              color="primary"
                              checked={
                                selectedMessagesIds.indexOf(
                                  chatbotMessage.identifier
                                ) > -1
                              }
                            />
                            <ListItemText primary={chatbotMessage.identifier} />
                          </MenuItem>
                        ))}
                    </Select>
                  </FormControl>
                </Badge>
              </div>
            </div>
            <ButtonWithSpinner
              variant="contained"
              color="primary"
              onClick={() => {
                getReport();
              }}
              loading={loadingReportHistory}
            >
              Sacar reporte
            </ButtonWithSpinner>
          </div>
        </Container>
      </div>
    </MainContainer>
  );
};

export default ApiChatbot;
