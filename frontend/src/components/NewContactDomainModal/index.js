import React, { useEffect, useState } from "react";

import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import TextField from "@material-ui/core/TextField";

import CircularProgress from "@material-ui/core/CircularProgress";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";

import Autocomplete from "@material-ui/lab/Autocomplete";
import microserviceApi from "../../services/microserviceApi";

import toastError from "../../errors/toastError";

import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";
import ButtonWithSpinner from "../ButtonWithSpinner";

const NewContactDomainModal = ({ modalOpen, onClose, contact }) => {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [selectedLocal, setSelectedLocal] = useState(null);

  useEffect(() => {
    if (!modalOpen) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchContacts = async () => {
        try {
          const { data: microserviceNumberData } = await microserviceApi.post(
            "/backendrestaurantpe/public/rest/common/localbi/searchwppticket",
            {
              busqueda: searchParam,
            }
          );
          console.log("microserviceNumberData: ", microserviceNumberData);
          if (
            microserviceNumberData &&
            microserviceNumberData.data?.length > 0
          ) {
            setOptions(microserviceNumberData.data);
          }
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

  const handleClose = () => {
    onClose();
    setSearchParam("");
    setSelectedLocal(null);
  };

  const handleSaveRelation = async (localbi_id) => {
    console.log("localbi_id", localbi_id);
    console.log("contact", contact);

    // return;

    setLoading(true);
    try {
      const { data } = await microserviceApi.post(
        "/backendrestaurantpe/public/rest/common/contactobi/store",
        {
          personabi_nombres: contact.name,
          personabi_apellidos: "central-wpp",
          personabi_telefono: contact.number,
          localbi_id: localbi_id,
        }
      );

      console.log("handleSaveRelation: ", data);
      toast("Dominio relacionado con éxito", { type: "success" });
      setLoading(false);
      handleClose();
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  };

  const handleSelectOption = (e, newValue) => {
    console.log("newValue", newValue);
    setSelectedLocal(newValue);
    // if (newValue?.number) {
    // } else if (newValue?.name) {
    //   setNewContact({ name: newValue.name });
    //   // setContactModalOpen(true);
    // }
  };

  const renderOption = (option) => {
    return (
      <div>
        <div style={{ fontWeight: "bold" }}>{option.link_dominio}</div>
        <div style={{ fontSize: "12px" }}>{option.direccion}</div>
      </div>
    );
  };

  const renderOptionLabel = (option) => {
    return option.link_dominio + " - " + option.direccion;
  };

  return (
    <>
      <Dialog open={modalOpen} onClose={handleClose} maxWidth="lg">
        <DialogTitle id="form-dialog-title">Relacionar dominio</DialogTitle>
        <DialogContent style={{ overflow: "visible" }}>
          <Autocomplete
            options={options}
            loading={loading}
            style={{ width: 400 }}
            clearOnBlur
            autoHighlight
            freeSolo
            clearOnEscape
            getOptionLabel={renderOptionLabel}
            renderOption={renderOption}
            onChange={(e, newValue) => handleSelectOption(e, newValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Dominio"
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
            disabled={!selectedLocal}
            onClick={() => handleSaveRelation(selectedLocal.localbi_id)}
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

export default NewContactDomainModal;
