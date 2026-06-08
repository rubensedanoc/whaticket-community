import React, { useState, useEffect } from "react";

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
import Paper from "@material-ui/core/Paper";
import Select from "@material-ui/core/Select";
import { makeStyles } from "@material-ui/core/styles";
import TableContainer from "@material-ui/core/TableContainer";
import Typography from "@material-ui/core/Typography";
import * as XLSX from "xlsx";
import useWhatsApps from "../../hooks/useWhatsApps";
import { i18n } from "../../translate/i18n";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@material-ui/core";

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

const SendMessagingCampaign = ({
  open,
  onClose,
  messagingCampaignId,
  isAMakertingCampaign,
}) => {
  const classes = useStyles();

  const [numbersToSend, setNumbersToSend] = useState([]);
  const [selectedWhatsappId, setSelectedWhatsappId] = useState("");
  const [sending, setSending] = useState(false);
  const [excelColumns, setExcelColumns] = useState([]);
  const [showColumnMapping, setShowColumnMapping] = useState(false);
  const [templateVariables, setTemplateVariables] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [campaignMessages, setCampaignMessages] = useState([]);

  const { whatsApps } = useWhatsApps();

  const handleClose = () => {
    onClose();
    setSelectedWhatsappId("");
    setNumbersToSend([]);
    setExcelColumns([]);
    setShowColumnMapping(false);
    setTemplateVariables([]);
    setColumnMapping({});
    setCampaignMessages([]);
  };

  // Load campaign details to check for template messages and get variable info
  useEffect(() => {
    if (open && messagingCampaignId) {
      (async () => {
        try {
          const url = isAMakertingCampaign
            ? `/marketingMessagingCampaign/${messagingCampaignId}`
            : `/messagingCampaigns/${messagingCampaignId}`;
          const { data } = await api.get(url);

          const messages = isAMakertingCampaign
            ? data.marketingCampaignAutomaticMessages || []
            : data.messagingCampaignMessages || [];
          setCampaignMessages(messages);

          // Check if any messages use templates
          const templateMessages = messages.filter(
            (m) => m.templatePayload
          );

          if (templateMessages.length > 0) {
            // Fetch the first template's variables for mapping
            // In practice, multiple templates could be supported by showing mapping per message
            const { data: tplData } = await api.get(
              `/templates/${templateMessages[0].templateId}`
            );
            if (tplData.variables) {
              let vars = [];
              if (Array.isArray(tplData.variables)) {
                vars = tplData.variables;
              } else if (typeof tplData.variables === "object") {
                vars = Object.entries(tplData.variables).map(([key, value]) => ({
                  index: parseInt(key, 10),
                  placeholder: `{{${key}}}`,
                  ...(typeof value === "object" ? value : {})
                }));
              }
              setTemplateVariables(vars);
            }
            // Also set friendly names
            if (tplData.friendlyNames) {
              const fnData = tplData.friendlyNames;
              setTemplateVariables((prev) =>
                prev.map((v) => ({
                  ...v,
                  friendlyName: fnData[String(v.index)] || `{{${v.index}}}`
                }))
              );
            }
          }
        } catch (err) {
          console.error("Error loading campaign messages:", err);
        }
      })();
    }
  }, [open, messagingCampaignId, isAMakertingCampaign]);

  const handleSendMessagingCampaign = async (values) => {
    setSending(true);
    try {
      // If column mapping exists, transform numbersToSend to include var_1, var_2 keys
      let finalNumbers = numbersToSend;
      if (templateVariables.length > 0 && Object.keys(columnMapping).length > 0) {
        finalNumbers = numbersToSend.map((row) => {
          const mappedRow = { ...row };
          templateVariables.forEach((v) => {
            const mappedColumn = columnMapping[String(v.index)];
            if (mappedColumn) {
              mappedRow[`var_${v.index}`] = row[mappedColumn];
            }
          });
          return mappedRow;
        });
      }

      values = {
        ...values,
        numbersToSend: JSON.stringify(finalNumbers),
        ...(isAMakertingCampaign
          ? { marketingMessagingCampaignId: messagingCampaignId }
          : { messagingCampaignId }),
        whatsappId: selectedWhatsappId,
      };

      const formData = new FormData();

      for (const key in values) {
        if (Object.prototype.hasOwnProperty.call(values, key)) {
          if (key === "file") {
            formData.append("medias", values.file);
          } else {
            formData.append(key, values[key]);
          }
        }
      }

      const { data } = await api.post(
        isAMakertingCampaign
          ? "/marketingMessagingCampaign/send"
          : "/messagingCampaigns/send",
        formData
      );

      toast.success("Campaña enviada correctamente");
      handleClose();
    } catch (err) {
      console.log(err?.response);
      toast.error(err?.response?.data?.error || "Error al enviar la campaña");
    }

    setSending(false);
  };

  const handleFileChange = (event) => {
    const file = event.currentTarget.files[0];

    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const binaryStr = e.target.result;
        const workbook = XLSX.read(binaryStr, { type: "binary" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        console.log("jsonData", jsonData);

        // Extraer encabezados eliminando valores vacíos o nulos
        const headers = jsonData[0].filter(
          (header) => header && header.trim() !== ""
        );

        setExcelColumns(headers);

        // Parsear las filas en objetos
        const parsedObjects = jsonData
          .slice(1)
          .filter((row) => row.length > 0)
          .map((row) => {
            const obj = {};
            headers.forEach((header, index) => {
              const cellValue =
                index === 0
                  ? `${row[index]}`.replaceAll(" ", "").replaceAll("+", "")
                  : row[index];
              obj[header.trim()] = cellValue || null;
            });
            return obj;
          });

        console.log("parsedObjects", parsedObjects);

        setNumbersToSend(
          parsedObjects.filter((obj) => obj.number && Number(obj.number))
        );

        // Show column mapping if template variables exist
        if (templateVariables.length > 0) {
          setShowColumnMapping(true);
        }
      };
      reader.readAsBinaryString(file);
    }
  };

  const getFriendlyLabel = (v) => {
    if (v.friendlyName && v.friendlyName !== `{{${v.index}}}`) {
      return `${v.friendlyName} ({{${v.index}}})`;
    }
    return v.placeholder || `{{${v.index}}}`;
  };

  return (
    <div className={classes.root}>
      <Dialog open={open} onClose={handleClose} scroll="paper">
        <DialogTitle>Enviar campaña de mensajes</DialogTitle>
        <Formik
          initialValues={{}}
          enableReinitialize={true}
          onSubmit={(values, actions) => {
            // console.log("values", values);
            setTimeout(() => {
              handleSendMessagingCampaign(values);
              actions.setSubmitting(false);
            }, 400);
          }}
        >
          {({ touched, errors, isSubmitting, setFieldValue }) => (
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
                      handleFileChange(event);
                      setFieldValue("file", event.currentTarget.files[0]);
                    }}
                    style={{ display: "block", marginBottom: "8px" }}
                  />
                  {touched.file && errors.file ? (
                    <FormHelperText error>{errors.file}</FormHelperText>
                  ) : null}
                </Box>

                {/* Column Mapping Section for Template Variables */}
                {showColumnMapping && templateVariables.length > 0 && (
                  <div style={{ marginTop: 20, marginBottom: 20 }}>
                    <Typography variant="subtitle1" style={{ fontWeight: "bold", marginBottom: 12 }}>
                      Mapeo de columnas para variables de plantilla
                    </Typography>
                    <Typography variant="body2" style={{ marginBottom: 12 }}>
                      Seleccione qué columna del Excel corresponde a cada variable:
                    </Typography>
                    {templateVariables.map((v) => (
                      <FormControl
                        key={v.index}
                        variant="outlined"
                        size="small"
                        style={{ width: "100%", marginBottom: "0.5rem" }}
                      >
                        <InputLabel>{getFriendlyLabel(v)}</InputLabel>
                        <Select
                          value={columnMapping[String(v.index)] || ""}
                          onChange={(e) =>
                            setColumnMapping((prev) => ({
                              ...prev,
                              [String(v.index)]: e.target.value
                            }))
                          }
                          label={getFriendlyLabel(v)}
                        >
                          <MenuItem value="">
                            <em>Seleccionar columna</em>
                          </MenuItem>
                          {excelColumns.map((col) => (
                            <MenuItem key={col} value={col}>
                              {col}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    ))}
                  </div>
                )}

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

                {numbersToSend.length > 0 && (
                  <div
                    style={{
                      marginTop: 20,
                      maxHeight: 300,
                      padding: 5,
                      overflowY: "auto",
                    }}
                  >
                    <TableContainer component={Paper}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            {Object.keys(numbersToSend[0])?.map(
                              (header, index) => (
                                <TableCell key={index} align="center">
                                  {header}
                                </TableCell>
                              )
                            )}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          <>
                            {numbersToSend.map((numberItem, index) => (
                              <TableRow key={index}>
                                {Object.values(numberItem).map(
                                  (value, index) => (
                                    <TableCell key={index} align="center">
                                      {value}
                                    </TableCell>
                                  )
                                )}
                              </TableRow>
                            ))}
                          </>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </div>
                )}
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

export default SendMessagingCampaign;
