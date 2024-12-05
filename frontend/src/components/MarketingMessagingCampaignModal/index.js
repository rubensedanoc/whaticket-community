import React, { useEffect, useState } from "react";

import { Field, Form, Formik } from "formik";
import { toast } from "react-toastify";
import * as Yup from "yup";

import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import { green } from "@material-ui/core/colors";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import IconButton from "@material-ui/core/IconButton";
import { makeStyles } from "@material-ui/core/styles";
import Tab from "@material-ui/core/Tab";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Tabs from "@material-ui/core/Tabs";
import TextField from "@material-ui/core/TextField";
import { DeleteOutline, Edit } from "@material-ui/icons";
import { format, fromUnixTime } from "date-fns";
import { i18n } from "../../translate/i18n";
import ModalImageCors from "../ModalImageCors";
import NumbersListModal from "../NumbersListModal";

import TicketListModal from "../TicketListModal";

import MarketingCampaignAutomaticMessage from "../MarketingCampaignAutomaticMessage";

import toastError from "../../errors/toastError";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },
  textField: {
    marginRight: theme.spacing(1),
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

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && children}
    </div>
  );
}

const MarketingCampaignSchema = Yup.object().shape({
  name: Yup.string().required("Required"),
});

const MarketingMessagingCampaignModal = ({
  open,
  onClose,
  marketingCampaignId,
  marketingMessagingCampaignId,
}) => {
  const classes = useStyles();

  const initialState = {
    name: "",
  };

  const [marketingMessagingCampaign, setMarketingMessagingCampaign] =
    useState(initialState);
  const [automaticMessageModalOpen, setAutomaticMessageModalOpen] =
    useState(false);
  const [
    selectedMarketingMessagingCampaign,
    setSelectedMarketingMessagingCampaign,
  ] = useState(null);

  const [ticketListModalOpen, setTicketListModalOpen] = useState(false);
  const [ticketListModalTitle, setTicketListModalTitle] = useState("");
  const [ticketListModalTickets, setTicketListModalTickets] = useState([]);

  const [numbersListModalOpen, setNumbersListModalOpen] = useState(false);
  const [numbersListModalTitle, setNumbersListModalTitle] = useState("");
  const [numbersListModalNumbers, setNumbersListModalNumbers] = useState([]);

  const [tabValue, setTabValue] = useState(0);

  const getData = async () => {
    try {
      const { data } = await api.get(
        `/marketingMessagingCampaign/${marketingMessagingCampaignId}`
      );
      setMarketingMessagingCampaign((prevState) => {
        return {
          ...prevState,
          ...data,
        };
      });
    } catch (err) {
      toastError(err);
    }
  };

  useEffect(() => {
    (async () => {
      if (!marketingMessagingCampaignId) return;
      getData();
    })();
    return () => {
      setMarketingMessagingCampaign(initialState);
    };
  }, [marketingMessagingCampaignId, open]);

  const handleClose = () => {
    onClose();
    setMarketingMessagingCampaign(initialState);
    setTabValue(0);
  };

  const handleSaveMarketingCampaign = async (values) => {
    try {
      console.log("----------values to submit", values);

      if (marketingMessagingCampaignId) {
        await api.put(
          `/marketingMessagingCampaign/${marketingMessagingCampaignId}`,
          values
        );
      } else {
        await api.post("/marketingMessagingCampaign", {
          ...values,
          marketingCampaignId,
        });
      }
      toast.success("MarketingCampaign saved successfully");
      handleClose();
    } catch (err) {
      toastError(err);
    }
  };

  function esArchivoDeImagen(nombreArchivo) {
    if (!nombreArchivo) {
      return false;
    }
    const extensionesImagen = [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".bmp",
      ".webp",
      ".tiff",
    ];
    const extension = nombreArchivo
      .slice(nombreArchivo.lastIndexOf("."))
      .toLowerCase();
    return extensionesImagen.includes(extension);
  }

  return (
    <div className={classes.root}>
      <MarketingCampaignAutomaticMessage
        open={automaticMessageModalOpen}
        onClose={() => {
          setAutomaticMessageModalOpen(false);
          setSelectedMarketingMessagingCampaign(null);
          getData();
        }}
        marketingCampaignAutomaticMessageId={
          selectedMarketingMessagingCampaign?.id
        }
        marketingMessagingCampaignId={marketingMessagingCampaignId}
      />

      <TicketListModal
        modalOpen={ticketListModalOpen}
        title={ticketListModalTitle}
        tickets={ticketListModalTickets}
        onClose={() => setTicketListModalOpen(false)}
        newView={true}
      />

      <NumbersListModal
        open={numbersListModalOpen}
        onClose={() => setNumbersListModalOpen(false)}
        modalTitle={numbersListModalTitle}
        numbersList={numbersListModalNumbers}
      />

      <Dialog open={open} onClose={handleClose} scroll="paper" maxWidth="md">
        <DialogTitle>
          {marketingMessagingCampaignId
            ? `Editar campaña de mensajes`
            : `Crear campaña de mensajes`}
        </DialogTitle>

        <Tabs
          value={tabValue}
          onChange={(event, newValue) => setTabValue(newValue)}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
          centered
        >
          <Tab label="GENERAL" />
          <Tab label="Historial" disabled={!marketingMessagingCampaignId} />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Formik
            initialValues={marketingMessagingCampaign}
            enableReinitialize={true}
            onSubmit={(values, actions) => {
              console.log("values", values);

              setTimeout(() => {
                handleSaveMarketingCampaign(values);
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
                  <Field
                    as={TextField}
                    label={"Nombre"}
                    fullWidth
                    autoFocus
                    name="name"
                    error={touched.name && Boolean(errors.name)}
                    helperText={touched.name && errors.name}
                    variant="outlined"
                    margin="dense"
                    className={classes.textField}
                  />

                  {marketingMessagingCampaignId && (
                    <>
                      <div style={{ display: "flex", justifyContent: "end" }}>
                        <Button
                          variant="contained"
                          color="primary"
                          onClick={() => {
                            setAutomaticMessageModalOpen(true);
                            setSelectedMarketingMessagingCampaign(null);
                          }}
                        >
                          Agregar Mensaje
                        </Button>
                      </div>

                      <Table size="medium">
                        <TableHead>
                          <TableRow>
                            <TableCell align="center">Orden</TableCell>
                            <TableCell align="center">Tipo</TableCell>
                            <TableCell align="center">Contenido</TableCell>
                            <TableCell align="center">Acciones</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          <>
                            {marketingMessagingCampaign.marketingCampaignAutomaticMessages?.map(
                              (message) => (
                                <TableRow key={message.id}>
                                  <TableCell align="center">
                                    {message.order}
                                  </TableCell>
                                  <TableCell align="center">
                                    {message.mediaType}
                                  </TableCell>
                                  <TableCell align="center">
                                    {message.mediaType === "text" ? (
                                      message.body
                                    ) : esArchivoDeImagen(message.mediaUrl) ? (
                                      <ModalImageCors
                                        imageUrl={message.mediaUrl}
                                      />
                                    ) : (
                                      message.mediaUrl
                                    )}
                                  </TableCell>
                                  <TableCell align="center">
                                    <IconButton
                                      size="small"
                                      onClick={() => {
                                        setAutomaticMessageModalOpen(true);
                                        setSelectedMarketingMessagingCampaign(
                                          message
                                        );
                                      }}
                                    >
                                      <Edit />
                                    </IconButton>

                                    <IconButton
                                      size="small"
                                      onClick={async () => {
                                        try {
                                          await api.delete(
                                            `/marketingCampaignAutomaticMessage/${message.id}`
                                          );
                                          toast.success(
                                            "MarketingCampaignAutomaticMessage deleted successfully"
                                          );
                                        } catch (err) {
                                          console.log(err);
                                          toastError(
                                            "Error deleting MarketingCampaignAutomaticMessage"
                                          );
                                        }
                                        getData();
                                      }}
                                    >
                                      <DeleteOutline />
                                    </IconButton>
                                  </TableCell>
                                </TableRow>
                              )
                            )}
                          </>
                        </TableBody>
                      </Table>
                    </>
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
                    disabled={isSubmitting}
                    variant="contained"
                    className={classes.btnWrapper}
                  >
                    {marketingMessagingCampaignId
                      ? `Guardar`
                      : `${i18n.t("queueModal.buttons.okAdd")}`}
                    {isSubmitting && (
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
        </TabPanel>
        <TabPanel value={tabValue} index={1}>
          <DialogContent dividers>
            <Table size="medium">
              <TableHead>
                <TableRow>
                  <TableCell align="center">Inicio</TableCell>
                  <TableCell align="center">Fin</TableCell>
                  <TableCell align="center">Usuario</TableCell>
                  <TableCell align="center">Conexión</TableCell>
                  <TableCell align="center">Estado</TableCell>
                  <TableCell align="center">Total Núms.</TableCell>
                  <TableCell align="center">Núms. Exitosos</TableCell>
                  <TableCell align="center">Núms. Fallidos</TableCell>
                  <TableCell align="center">Sin Respuesta</TableCell>
                  <TableCell align="center">Con Respuesta</TableCell>
                  <TableCell align="center"></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <>
                  {marketingMessagingCampaign.marketingMessagingCampaignShipments?.map(
                    (shipment) => (
                      <TableRow key={shipment.id}>
                        <TableCell align="center">
                          {shipment.startTimestamp
                            ? format(
                                fromUnixTime(shipment.startTimestamp),
                                "yyyy/MM/dd HH:mm:ss"
                              )
                            : "-"}
                        </TableCell>
                        <TableCell align="center">
                          {shipment.endTimestamp
                            ? format(
                                fromUnixTime(shipment.endTimestamp),
                                "yyyy/MM/dd HH:mm:ss"
                              )
                            : "-"}
                        </TableCell>
                        <TableCell align="center">
                          {shipment.user?.name}
                        </TableCell>
                        <TableCell align="center">
                          {shipment.whatsapp?.name}
                        </TableCell>
                        <TableCell align="center">{shipment.status}</TableCell>

                        {/* TOTAL */}
                        <TableCell
                          align="center"
                          style={{
                            cursor: "pointer",
                            color: "blue",
                          }}
                          onClick={() => {
                            setNumbersListModalTitle("Total de números");
                            setNumbersListModalOpen(true);
                            setNumbersListModalNumbers(
                              shipment.marketingMessagingCampaignShipmentNumbers?.map(
                                (n) => {
                                  return n.number;
                                }
                              )
                            );
                          }}
                        >
                          {
                            shipment.marketingMessagingCampaignShipmentNumbers
                              ?.length
                          }
                        </TableCell>

                        {/* EXITOSOS */}
                        <TableCell
                          align="center"
                          style={{
                            cursor: "pointer",
                            color: "blue",
                          }}
                          onClick={() => {
                            setNumbersListModalTitle(
                              "Total de números exitosos"
                            );
                            setNumbersListModalOpen(true);
                            setNumbersListModalNumbers(
                              shipment.marketingMessagingCampaignShipmentNumbers
                                ?.filter((number) => !number.hadError)
                                ?.map((n) => {
                                  return n.number;
                                })
                            );
                          }}
                        >
                          {
                            shipment.marketingMessagingCampaignShipmentNumbers?.filter(
                              (number) => !number.hadError
                            ).length
                          }
                        </TableCell>

                        {/* FALLIDOS */}
                        <TableCell
                          align="center"
                          style={{
                            cursor: "pointer",
                            color: "blue",
                          }}
                          onClick={() => {
                            setNumbersListModalTitle(
                              "Total de números fallidos"
                            );
                            setNumbersListModalOpen(true);
                            setNumbersListModalNumbers(
                              shipment.marketingMessagingCampaignShipmentNumbers
                                ?.filter((number) => number.hadError)
                                ?.map((n) => {
                                  return n.number;
                                })
                            );
                          }}
                        >
                          {
                            shipment.marketingMessagingCampaignShipmentNumbers?.filter(
                              (number) => number.hadError
                            ).length
                          }
                        </TableCell>

                        {/* SIN RESPUESTA */}
                        <TableCell
                          align="center"
                          style={{
                            cursor: "pointer",
                            color: "blue",
                          }}
                          onClick={() => {
                            setTicketListModalTitle("Tickets sin respuesta");
                            setTicketListModalTickets(
                              shipment?.noResponse?.map((t) => {
                                return t.id;
                              })
                            );
                            setTicketListModalOpen(true);
                          }}
                        >
                          {shipment?.noResponse?.length}
                        </TableCell>

                        {/* CON RESPUESTA */}
                        <TableCell
                          align="center"
                          style={{
                            cursor: "pointer",
                            color: "blue",
                          }}
                          onClick={() => {
                            setTicketListModalTitle("Tickets con respuesta");
                            setTicketListModalTickets(
                              shipment?.withResponse?.map((t) => {
                                return t.id;
                              })
                            );
                            setTicketListModalOpen(true);
                          }}
                        >
                          {shipment?.withResponse?.length}
                        </TableCell>

                        {/* EXCEL */}
                        <TableCell align="center">
                          <a href={shipment.excelUrl}>Ver Excel</a>
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </>
              </TableBody>
            </Table>
          </DialogContent>
        </TabPanel>
      </Dialog>
    </div>
  );
};

export default MarketingMessagingCampaignModal;
