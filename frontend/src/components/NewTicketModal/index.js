import React, { useContext, useEffect, useState } from "react";
import { useHistory } from "react-router-dom";

import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import TextField from "@material-ui/core/TextField";

import CircularProgress from "@material-ui/core/CircularProgress";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";

import { ListItemText } from "@material-ui/core";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import Autocomplete, {
  createFilterOptions,
} from "@material-ui/lab/Autocomplete";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";

import MenuItem from "@material-ui/core/MenuItem";
import { AuthContext } from "../../context/Auth/AuthContext";
import toastError from "../../errors/toastError";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import ButtonWithSpinner from "../ButtonWithSpinner";
import ContactModal from "../ContactModal";
import Typography from "@material-ui/core/Typography";
import Box from "@material-ui/core/Box";

const filter = createFilterOptions({
  trim: true,
});

const NewTicketModal = ({ preSelectedContactId, modalOpen, onClose }) => {
  const history = useHistory();

  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedWhatsappId, setSelectedWhatsappId] = useState("");
  const [newContact, setNewContact] = useState({});
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const { user } = useContext(AuthContext);
  const { whatsApps } = useContext(WhatsAppsContext);
  const [key, setKey] = useState(0);
  const [conversationWindow, setConversationWindow] = useState(null);
  const [windowLoading, setWindowLoading] = useState(false);

  useEffect(() => {
    if (!modalOpen) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchContacts = async () => {
        try {
          const { data } = await api.get("contacts", {
            params: {
              searchParam,
            },
          });
          console.log("data: ", data.contacts);
          setOptions(data.contacts);
          setLoading(false);
        } catch (err) {
          setLoading(false);
          toastError(err);
        }
      };

      fetchContacts();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, modalOpen]);

  // Fetch conversation window when both contact and whatsapp are selected
  useEffect(() => {
    if (!selectedContact?.id || !selectedWhatsappId) {
      setConversationWindow(null);
      return;
    }

    setWindowLoading(true);
    const fetchWindow = async () => {
      try {
        const { data } = await api.get(
          `/contacts/${selectedContact.id}/conversation-window`,
          { params: { whatsappId: selectedWhatsappId } }
        );
        setConversationWindow(data);
      } catch (err) {
        console.log("Error fetching conversation window:", err);
        setConversationWindow(null);
      } finally {
        setWindowLoading(false);
      }
    };

    fetchWindow();
  }, [selectedContact?.id, selectedWhatsappId]);

  const handleClose = () => {
    onClose();
    setSearchParam("");
    setSelectedContact(null);
  };

  const handleSaveTicket = async (contactId, whatsappId) => {
    console.log("contactId", contactId);
    console.log("whatsappId", whatsappId);

    if (!contactId && !whatsappId) {
      toastError("Selecciona un contacto y una conexión");
      return;
    }

    setLoading(true);
    try {
      const { data: ticket } = await api.post("/tickets", {
        contactId: contactId,
        userId: user.id,
        status: "open",
        whatsappId,
      });

      await api.post(`/privateMessages/${ticket.id}`, {
        body: `${user?.name} *Creó* un nuevo ticket`,
      });

      history.push(`/tickets/${ticket.id}`);
      setLoading(false);
      handleClose();
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  };

  const handleSelectOption = (e, newValue) => {
    if (newValue?.number) {
      setSelectedContact(newValue);
    } else if (newValue?.name) {
      setNewContact({
        number: newValue.name.replaceAll(" ", "").replaceAll("+", ""),
      });
      setContactModalOpen(true);
    }
  };

  const handleCloseContactModal = () => {
    setContactModalOpen(false);
  };

  const handleAddNewContactTicket = (contact) => {
    console.log("handleAddNewContactTicket contact", contact);
    setKey((key) => key + 1);
  };

  const createAddContactOption = (filterOptions, params) => {
    const filtered = filterOptions;

    if (params.inputValue !== "" && !loading && searchParam.length >= 3) {
      filtered.push({
        name: `${params.inputValue}`,
      });
    }

    return filtered;
  };

  const renderOption = (option) => {
    if (option.number) {
      return `${option.name} - ${option.number}`;
    } else {
      return `${i18n.t("newTicketModal.add")} ${option.name}`;
    }
  };

  const renderOptionLabel = (option) => {
    if (option.number) {
      return `${option.name} - ${option.number}`;
    } else {
      return `${option.name}`;
    }
  };

  return (
    <>
      <ContactModal
        open={contactModalOpen}
        initialValues={newContact}
        onClose={handleCloseContactModal}
        onSave={handleAddNewContactTicket}
      ></ContactModal>
      <Dialog open={modalOpen} onClose={handleClose} maxWidth="lg">
        <DialogTitle id="form-dialog-title">
          {i18n.t("newTicketModal.title")}
        </DialogTitle>
        <DialogContent style={{ overflow: "visible" }}>
          {!preSelectedContactId && (
            <>
              <Autocomplete
                options={options}
                loading={loading}
                style={{ width: 300 }}
                clearOnBlur
                autoHighlight
                freeSolo
                clearOnEscape
                key={key}
                getOptionLabel={renderOptionLabel}
                renderOption={renderOption}
                filterOptions={createAddContactOption}
                onChange={(e, newValue) => handleSelectOption(e, newValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={i18n.t("newTicketModal.fieldLabel")}
                    variant="outlined"
                    autoFocus
                    onChange={(e) => setSearchParam(e.target.value)}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <React.Fragment>
                          {loading ? (
                            <CircularProgress color="inherit" size={20} />
                          ) : null}
                          {params.InputProps.endAdornment}
                        </React.Fragment>
                      ),
                    }}
                  />
                )}
              />
              <br />
            </>
          )}

          <FormControl
            fullWidth={true}
            margin="dense"
            variant="outlined"
            style={{ width: "300px" }}
          >
            <InputLabel>Conexion</InputLabel>

            <Select
              labelWidth={60}
              value={selectedWhatsappId}
              onChange={(event) => setSelectedWhatsappId(event.target.value)}
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
              {whatsApps?.length > 0 &&
                whatsApps.map((whatsapp) => {
                  // console.log("whatsapp", whatsapp);
                  // console.log("user", user);

                  const isTheLastWppOfTheContact =
                    selectedContact?.tickets?.length > 0 &&
                    selectedContact.tickets[selectedContact.tickets.length - 1]
                      .whatsappId === whatsapp.id;

                  const isTheWppOfTheUser = user.whatsappId === whatsapp.id;

                  if (
                    user.profile !== "admin" &&
                    user.profile !== "superUser"
                  ) {
                    if (isTheLastWppOfTheContact || isTheWppOfTheUser) {
                      let secondaryText = "";

                      if (isTheLastWppOfTheContact) {
                        secondaryText += " - Ultima Conexión del contacto";
                      }

                      if (isTheWppOfTheUser) {
                        secondaryText += " - Tu conexión asignada";
                      }
                      return (
                        <MenuItem key={whatsapp.id} value={whatsapp.id} dense>
                          <ListItemText
                            primary={whatsapp.name}
                            secondary={secondaryText || undefined}
                          />
                        </MenuItem>
                      );
                    } else {
                      return null;
                    }
                  } else {
                    let secondaryText = "";

                    if (isTheLastWppOfTheContact) {
                      secondaryText += " - Ultima Conexión del contacto";
                    }

                    if (isTheWppOfTheUser) {
                      secondaryText += " - Tu conexión asignada";
                    }

                    return (
                      <MenuItem key={whatsapp.id} value={whatsapp.id} dense>
                        <ListItemText
                          primary={whatsapp.name}
                          secondary={secondaryText || undefined}
                        />
                      </MenuItem>
                    );
                  }
                })}
            </Select>
          </FormControl>
          {conversationWindow && (
            <Box mt={1} style={{ width: "300px" }}>
              {conversationWindow.isOpen && conversationWindow.type === "active" ? (
                <Typography
                  variant="body2"
                  style={{ color: "#4caf50", fontWeight: 500 }}
                >
                  🟢 Podrás enviar texto libre.
                </Typography>
              ) : (
                <Typography
                  variant="body2"
                  style={{ color: "#f44336", fontWeight: 500 }}
                >
                  🔴 Se enviará como plantilla. Recomendamos un solo mensaje hasta que el cliente responda.
                </Typography>
              )}
            </Box>
          )}
          {windowLoading && selectedContact?.id && selectedWhatsappId && (
            <Box mt={1} style={{ width: "300px" }}>
              <CircularProgress size={16} />
            </Box>
          )}
          <br />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleClose}
            color="secondary"
            disabled={loading}
            variant="outlined"
          >
            {i18n.t("newTicketModal.buttons.cancel")}
          </Button>
          <ButtonWithSpinner
            variant="contained"
            type="button"
            disabled={
              (!preSelectedContactId && !selectedContact) || !selectedWhatsappId
            }
            onClick={() =>
              handleSaveTicket(
                selectedContact?.id || preSelectedContactId,
                selectedWhatsappId
              )
            }
            color="primary"
            loading={loading}
          >
            {i18n.t("newTicketModal.buttons.ok")}
          </ButtonWithSpinner>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default NewTicketModal;
