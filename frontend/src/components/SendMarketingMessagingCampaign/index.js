import React, { useState } from "react";

import { Form, Formik } from "formik";
import { toast } from "react-toastify";
import api from "../../services/api";

import { Box, FormHelperText, ListItemText } from "@material-ui/core";
import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import { green } from "@material-ui/core/colors";
import Dialog from "@material-ui/core/Dialog";

import DialogActions from "@material-ui/core/DialogActions";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";

import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";

import MenuItem from "@material-ui/core/MenuItem";
import Select from "@material-ui/core/Select";
import { makeStyles } from "@material-ui/core/styles";
import * as XLSX from "xlsx";
import useWhatsApps from "../../hooks/useWhatsApps";
import { i18n } from "../../translate/i18n";

import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },
  textField: {
    // marginRight: theme.spacing(1),
    marginRight: 0,
    marginBottom: "1rem",
    flex: 1,
  },

  btnWrapper: {
    position: "relative",
  },

  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120,
  },
  colorAdorment: {
    width: 20,
    height: 20,
  },
}));

const SendMarketingMessagingCampaign = ({
  open,
  onClose,
  marketingMessagingCampaignId,
}) => {
  const classes = useStyles();

  const initialState = {
    order: 1,
    body: "",
    mediaType: "text",
    mediaUrl: "",
  };

  const [
    marketingCampaignAutomaticMessage,
    setMarketingCampaignAutomaticMessage,
  ] = useState(initialState);

  const [numbersToSend, setNumbersToSend] = useState([]);
  const [selectedWhatsappId, setSelectedWhatsappId] = useState("");
  const [sending, setSending] = useState(false);

  const { whatsApps } = useWhatsApps();

  const handleClose = () => {
    onClose();
    setMarketingCampaignAutomaticMessage(initialState);
  };

  const handleSendMarketingMessagingCampaign = async (values) => {
    setSending(true);
    try {
      values = {
        ...values,
        numbersToSend,
        marketingMessagingCampaignId,
        whatsappId: selectedWhatsappId,
      };

      const { data } = await api.post(
        "/marketingMessagingCampaign/send",
        values
      );

      if (!data.ok || data.numbersWithErrors.length > 0) {
        if (data.numbersWithErrors.length) {
          alert(
            `Estos números tuvieron error en el envio: ${data.numbersWithErrors
              .map((numbersWithError) => numbersWithError.number)
              .join(", ")}`
          );
        }
        toast.error("Algo falló al enviar la campaña de mensajes");
      } else {
        toast.success("Camapaña enviada correctamente");
      }

      handleClose();
    } catch (err) {
      console.log(err);
      toastError("Error saving MarketingCampaignAutomaticMessage");
    }

    setSending(false);
  };

  return (
    <div className={classes.root}>
      <Dialog open={open} onClose={handleClose} scroll="paper">
        <DialogTitle>Enviar campaña de mensajes</DialogTitle>
        <Formik
          initialValues={marketingCampaignAutomaticMessage}
          enableReinitialize={true}
          onSubmit={(values, actions) => {
            // console.log("values", values);
            setTimeout(() => {
              handleSendMarketingMessagingCampaign(values);
              actions.setSubmitting(false);
            }, 400);
          }}
        >
          {({
            values,
            handleChange,
            handleBlur,
            touched,
            errors,
            isSubmitting,
            setFieldValue,
          }) => (
            <Form>
              <DialogContent dividers>
                <FormControl
                  fullWidth
                  margin="dense"
                  variant="outlined"
                  style={{ marginBottom: "2rem" }}
                >
                  <InputLabel>Conexión</InputLabel>
                  <Select
                    displayEmpty
                    label="Conexión"
                    variant="outlined"
                    value={selectedWhatsappId}
                    onChange={(e) => setSelectedWhatsappId(e.target.value)}
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
                    // renderValue={() => "Conexiones"}
                  >
                    {whatsApps?.length > 0 &&
                      whatsApps.map((whatsapp) => (
                        <MenuItem dense key={whatsapp.id} value={whatsapp.id}>
                          <ListItemText primary={whatsapp.name} />
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>

                <Box margin="normal">
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: "bold",
                      marginBottom: 8,
                    }}
                  >
                    Excel de números{" "}
                    <span style={{ fontSize: 10 }}>
                      (Los números deben de estar en la primera columna)
                    </span>
                  </div>
                  <input
                    id="file"
                    name="file"
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={(event) => {
                      // Establece el archivo en los valores de Formik

                      const file = event.currentTarget.files[0];

                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                          const binaryStr = e.target.result;
                          const workbook = XLSX.read(binaryStr, {
                            type: "binary",
                          });
                          const firstSheetName = workbook.SheetNames[0];
                          const worksheet = workbook.Sheets[firstSheetName];
                          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                            header: 1,
                          });
                          // Leer la primera columna (columna 0)
                          const firstColumn = jsonData.map((row) => row[0]);
                          setNumbersToSend(
                            firstColumn.filter((number) => number)
                          );
                        };
                        reader.readAsBinaryString(file);
                      }

                      setFieldValue("file", event.currentTarget.files[0]);
                    }}
                    style={{ display: "block", marginBottom: "8px" }}
                  />
                  {touched.file && errors.file ? (
                    <FormHelperText error>{errors.file}</FormHelperText>
                  ) : null}
                </Box>

                <div>
                  Cantidad de números a enviar:{" "}
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: "bold",
                      marginBottom: 8,
                    }}
                  >
                    {numbersToSend.length}
                  </span>
                </div>
              </DialogContent>
              <DialogActions>
                <Button
                  onClick={handleClose}
                  color="secondary"
                  disabled={isSubmitting}
                  variant="outlined"
                >
                  {i18n.t("queueModal.buttons.cancel")}
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  disabled={
                    isSubmitting ||
                    !numbersToSend.length ||
                    !selectedWhatsappId ||
                    sending
                  }
                  variant="contained"
                  className={classes.btnWrapper}
                >
                  Enviar
                  {(isSubmitting || sending) && (
                    <CircularProgress
                      size={24}
                      className={classes.buttonProgress}
                    />
                  )}
                </Button>
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>
    </div>
  );
};

export default SendMarketingMessagingCampaign;
