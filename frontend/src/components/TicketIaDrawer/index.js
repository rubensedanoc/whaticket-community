import React, { useContext, useEffect, useState, useRef } from "react";

import Avatar from "@material-ui/core/Avatar";
import Button from "@material-ui/core/Button";
import Chip from "@material-ui/core/Chip";
import Drawer from "@material-ui/core/Drawer";
import IconButton from "@material-ui/core/IconButton";
import InputLabel from "@material-ui/core/InputLabel";
import Link from "@material-ui/core/Link";
import Paper from "@material-ui/core/Paper";

import { makeStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import CloseIcon from "@material-ui/icons/Close";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import api from "../../services/api";
import ButtonWithSpinner from "../ButtonWithSpinner";
import { toast } from "react-toastify";

import { i18n } from "../../translate/i18n";

import ContactDrawerSkeleton from "../ContactDrawerSkeleton";
import ContactModal from "../ContactModal";
import MarkdownWrapper from "../MarkdownWrapper";

import toastError from "../../errors/toastError";
import TicketListItem from "../TicketListItem";
import { NumberGroups } from "../NumberGroupsModal";  
import InputBase from "@material-ui/core/InputBase";

const drawerWidth = 280;

const useStyles = makeStyles((theme) => ({
  drawer: {
    width: drawerWidth,
    flexShrink: 0,
  },
  drawerPaper: {
    width: drawerWidth,
    display: "flex",
    borderTop: "1px solid rgba(0, 0, 0, 0.12)",
    borderRight: "1px solid rgba(0, 0, 0, 0.12)",
    borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  header: {
    display: "flex",
    borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
    backgroundColor: "#eee",
    alignItems: "center",
    padding: theme.spacing(0, 1),
    minHeight: "73px",
    justifyContent: "flex-start",
  },
  content: {
    display: "flex",
    backgroundColor: "#eee",
    flexDirection: "column",
    padding: "8px 0px 8px 8px",
    height: "100%",
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },

  contactAvatar: {
    margin: 15,
    width: 120,
    height: 120,
  },

  contactHeader: {
    display: "flex",
    padding: 8,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    "& > *": {
      margin: 4,
    },
  },

  contactDetails: {
    marginTop: 8,
    padding: 8,
    display: "flex",
    flexDirection: "column",
  },
  contactExtraInfo: {
    display: "flex",
    marginTop: 4,
    padding: 6,
  },
}));

const TicketIaDrawer = ({
  open,
  handleDrawerClose,
  contact,
  loading,
  ticketId,
  microServiceData,
  ticket
}) => {
  const classes = useStyles();

  const [iaInputMessage, setIaInputMessage] = useState([]);
  const [loadingIaResponse, setLoadingIaResponse] = useState(false);
  const [iaRevisionLoading, setIaRevisionLoading] = useState(false);

  const inputRef = useRef();

  const handleSendMessage = async () => {
    if (iaInputMessage.trim() === "") return;
    setLoadingIaResponse(true); 

    try {
      const { data } = await api.post(`/conversationIAQuestion`, {
        ticketId,
        question: {
          text: iaInputMessage,
        },
      });
      console.log("Respuesta de IA:", data);
      ticket.conversationIAQuestions.push(data);
    } catch (err) {
      toastError(err);
    }

    setIaInputMessage("");
    setLoadingIaResponse(false);
  };

  const handleIARevision = async () => {
    try {
      setIaRevisionLoading(true);
      api.post(`conversationIAEvalutaion/analize`, {
        ticketId: ticket.id,
      });
      setTimeout(() => {
        setIaRevisionLoading(false);
        toast.success("Revisión con IA iniciada, Espera unos minutos y recarga la pagina para ver los resultados.");
      }, 1000);
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Drawer
      className={classes.drawer}
      variant="persistent"
      anchor="left"
      open={open}
      PaperProps={{ style: { position: "absolute" } }}
      BackdropProps={{ style: { position: "absolute" } }}
      ModalProps={{
        container: document.getElementById("drawer-container"),
        style: { position: "absolute" },
      }}
      classes={{
        paper: classes.drawerPaper,
      }}
    >
      <div className={classes.header}>
        <IconButton onClick={handleDrawerClose}>
          <CloseIcon />
        </IconButton>
        <Typography style={{ justifySelf: "center" }}>
          Informe IA
        </Typography>
      </div>

      <ButtonWithSpinner
        variant="contained" color="primary"
        loading={iaRevisionLoading}
        size="small"
        onClick={(e) => handleIARevision()}
      >Generar revisión IA</ButtonWithSpinner>

      {loading ? (
        <ContactDrawerSkeleton classes={classes} />
      ) : (
        <div className={classes.content}>
          <Paper
            square
            variant="outlined"
            className={classes.contactDetails}
            style={{ gap: "6px" }}
          >
            <Typography variant="subtitle1">
              <span style={{ fontWeight: "bold" }}>
                Resumen del grupo
              </span>
            </Typography>
            <div>
              {(()=>{
                const IaEvaluation = ticket?.conversationIAEvalutaions?.[0];

                if (!IaEvaluation) {
                  return <Typography variant="body2">No hay evaluación IA disponible(1)</Typography>;
                }

                const resultTwo = JSON.parse(IaEvaluation.resultTwo || "{}");;

                if (!resultTwo) {
                  return <Typography variant="body2">No hay evaluación IA disponible(2)</Typography>;
                }

                return (
                  <>
                    <Typography variant="body2">
                      <span style={{  }}>
                        {resultTwo.justificacion}
                      </span>
                    </Typography>
                  </>
                );
                
              })()}
            </div>
          </Paper>

          <Paper
            square
            variant="outlined"
            className={classes.contactDetails}
            style={{ gap: "6px" }}
          >
            <Typography variant="subtitle1">
              <span style={{ fontWeight: "bold" }}>
                Preguntas
              </span>
            </Typography>

            {
              ticket?.conversationIAQuestions?.map((question, index) => (
                <div key={index} style={{ marginBottom: "8px" }}>
                  <Typography variant="body2" style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.8rem" }}>
                      {new Date(question.createdAt).toLocaleDateString("es-ES", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit", 
                      })}
                    </div>
                    <div>
                      {
                        question.user?.name
                      }
                    </div>
                    <div style={{ fontWeight: "bold" }}>
                      Pregunta:
                    </div>
                    {JSON.parse(question.question).text}
                  </Typography>
                  <br />
                  <Typography variant="body2">
                    <div style={{ fontWeight: "bold" }}>
                      Respuesta IA:
                    </div>
                    {JSON.parse(question.response).text}
                  </Typography>
                </div>
              ))
            }

            <InputBase
              inputRef={(input) => {
                // input && input.focus();
                input && (inputRef.current = input);
              }}
              className={classes.messageInput}
              placeholder={"Escribe tu pregunta aquí..."}
              multiline
              maxRows={5}
              value={iaInputMessage}
              onChange={(e)=>setIaInputMessage(e.target.value)}
              disabled={loadingIaResponse || loading}
              onKeyPress={(e) => {
                if (loading || e.shiftKey) return;
                else if (e.key === "Enter") {
                  handleSendMessage();
                }
              }}
            />
          </Paper>

        </div>
      )}
    </Drawer>
  );
};

export default TicketIaDrawer;
