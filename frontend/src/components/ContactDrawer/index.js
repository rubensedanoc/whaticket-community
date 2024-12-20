import React, { useContext, useEffect, useState } from "react";

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

import { i18n } from "../../translate/i18n";

import ContactDrawerSkeleton from "../ContactDrawerSkeleton";
import ContactModal from "../ContactModal";
import MarkdownWrapper from "../MarkdownWrapper";

const drawerWidth = 320;

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
    width: 160,
    height: 160,
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
    marginTop: 4,
    padding: 6,
  },
}));

const ContactDrawer = ({
  open,
  handleDrawerClose,
  contact,
  loading,
  ticketId,
  microServiceData,
}) => {
  const classes = useStyles();

  const [modalOpen, setModalOpen] = useState(false);
  const [groupParticipants, setGroupParticipants] = useState([]);
  const { whatsApps } = useContext(WhatsAppsContext);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (open && ticketId && contact?.isGroup) {
        (async () => {
          try {
            console.log("Pidiendo integrantes del grupo");

            const { data } = await api.get("/showParticipants/" + ticketId);

            setGroupParticipants(data || []);

            console.log("integrantes del grupo ", data);
          } catch (err) {
            console.log("Error al obtener integrantes del grupo", err);
          }
        })();
      }
    }, 500);

    return () => {
      setGroupParticipants([]);
      clearTimeout(delayDebounceFn);
    };
  }, [open, ticketId, contact]);

  return (
    <Drawer
      className={classes.drawer}
      variant="persistent"
      anchor="right"
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
          {contact?.isGroup ? "Detalles del grupo" : "Detalles del contacto"}
        </Typography>
      </div>

      {loading ? (
        <ContactDrawerSkeleton classes={classes} />
      ) : (
        <div className={classes.content}>
          <Paper square variant="outlined" className={classes.contactHeader}>
            <Avatar
              alt={contact.name}
              src={contact.profilePicUrl}
              className={classes.contactAvatar}
            ></Avatar>

            <Typography>{contact.name}</Typography>
            <Typography>
              <Link href={`tel:${contact.number}`}>{contact.number}</Link>
            </Typography>
            <Button
              variant="outlined"
              color="primary"
              onClick={() => setModalOpen(true)}
            >
              {i18n.t("contactDrawer.buttons.edit")}
            </Button>
          </Paper>

          {contact?.isGroup && (
            <Paper
              square
              variant="outlined"
              className={classes.contactDetails}
              style={{ gap: "6px" }}
            >
              <Typography variant="subtitle1">
                {" "}
                <span style={{ fontWeight: "bold" }}>
                  Integrantes del grupo
                </span>
              </Typography>
              <div></div>
              {groupParticipants?.map((value, index) => (
                <div
                  className={classes.messageQuickAnswersWrapperItem}
                  key={index}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      maxHeight: "unset",
                      marginBottom: "8px",
                    }}
                  >
                    <Avatar src={value.profilePicUrl} alt={value.name} />
                    <div>
                      {`${value.name} - ${value.number}`}
                      {whatsApps.find(
                        (whatsapp) => whatsapp.number === value.number
                      ) && (
                        <Chip
                          style={{ height: "20px", fontSize: "11px" }}
                          color="primary"
                          size="small"
                          label="Conexión nuestra"
                        />
                      )}
                      {value.isCompanyMember && (
                        <Chip
                          style={{ height: "20px", fontSize: "11px" }}
                          color="primary"
                          size="small"
                          label="Miembro de la empresa"
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </Paper>
          )}

          {microServiceData &&
            microServiceData.map((data, index) => (
              <Paper
                key={index}
                square
                variant="outlined"
                className={classes.contactDetails}
                style={{ gap: "6px" }}
              >
                <Typography variant="subtitle1">
                  <span style={{ fontWeight: "bold" }}>Microservice</span>{" "}
                  <a href={"https://" + data.link_dominio} target="_blank">
                    {data.link_dominio}
                  </a>
                </Typography>
                <div></div>
                {(() => {
                  const microserviceItems = [
                    "fecha_alta",
                    "tipo_cliente",
                    "localbi_kam",
                    "plan",
                    "mensualidad",
                    "localbi_ltv",
                    "local",
                    "pais",
                    "ciudad",
                    "direccion",
                  ];

                  return Object.entries(data)
                    .filter(([key]) => microserviceItems.includes(key))
                    .sort(
                      ([keyA], [keyB]) =>
                        microserviceItems.indexOf(keyA) -
                        microserviceItems.indexOf(keyB)
                    )
                    .map(([key, value], index) => (
                      <Paper
                        key={index}
                        square
                        variant="outlined"
                        className={classes.contactExtraInfo}
                      >
                        <InputLabel
                          style={{
                            fontWeight: "bold",
                            textTransform: "uppercase",
                            fontSize: "0.8rem",
                          }}
                        >
                          {key}
                        </InputLabel>
                        {
                          <Typography
                            component="div"
                            noWrap
                            style={{ paddingTop: 4 }}
                          >
                            {value || "-"}
                          </Typography>
                        }
                      </Paper>
                    ));
                })()}
              </Paper>
            ))}

          {contact?.extraInfo?.length > 0 && (
            <Paper square variant="outlined" className={classes.contactDetails}>
              <Typography variant="subtitle1">
                {i18n.t("contactDrawer.extraInfo")}
              </Typography>
              {contact?.extraInfo?.map((info) => (
                <Paper
                  key={info.id}
                  square
                  variant="outlined"
                  className={classes.contactExtraInfo}
                >
                  <InputLabel>{info.name}</InputLabel>
                  <Typography component="div" noWrap style={{ paddingTop: 2 }}>
                    <MarkdownWrapper>{info.value}</MarkdownWrapper>
                  </Typography>
                </Paper>
              ))}
            </Paper>
          )}
        </div>
      )}

      <ContactModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        contactId={contact.id}
      ></ContactModal>
    </Drawer>
  );
};

export default ContactDrawer;
