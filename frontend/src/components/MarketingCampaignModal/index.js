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
import Switch from "@material-ui/core/Switch";
import Tab from "@material-ui/core/Tab";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Tabs from "@material-ui/core/Tabs";
import TextField from "@material-ui/core/TextField";
import { DeleteOutline, Edit } from "@material-ui/icons";
import Autocomplete from "@material-ui/lab/Autocomplete";
import { format } from "date-fns";
import ButtonWithSpinner from "../ButtonWithSpinner";
import ConfirmationModal from "../ConfirmationModal";
import MarketingMessagingCampaignModal from "../MarketingMessagingCampaignModal";

import ModalImageCors from "../ModalImageCors";
import SendMarketingMessagingCampaign from "../SendMarketingMessagingCampaign";

import { i18n } from "../../translate/i18n";

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
  name: Yup.string()
    .min(2, "Too Short!")
    .max(50, "Too Long!")
    .required("Required"),
  color: Yup.string().min(3, "Too Short!").max(9, "Too Long!").required(),
});

const MarketingCampaignModal = ({ open, onClose, marketingCampaignId }) => {
  const classes = useStyles();

  const [tabValue, setTabValue] = useState(0);

  const initialState = {
    name: "",
    isActive: true,
    keywords: [],
  };

  const [marketingCampaign, setMarketingCampaign] = useState(initialState);
  const [
    marketingCampaignAutomaticMessageModalOpen,
    setMarketingCampaignAutomaticMessageModalOpen,
  ] = useState(false);
  const [
    marketingMessagingCampaignModalOpen,
    setMarketingMessagingCampaignModalOpen,
  ] = useState(false);
  const [
    sendMarketingMessagingCampaignOpen,
    setSendMarketingMessagingCampaignOpen,
  ] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [
    selectedMarketingCampaignAutomaticMessage,
    setSelectedMarketingCampaignAutomaticMessage,
  ] = useState(null);
  const [
    selectedMarketingMessagingCampaign,
    setSelectedMarketingMessagingCampaign,
  ] = useState(null);

  const [confirmationModalOpen, setConfirmationModalOpen] = useState(false);
  const [confirmationModalTitle, setConfirmationModalTitle] = useState("");
  const [confirmationModalHandler, setConfirmationModalHandler] = useState(
    () => () => {}
  );

  const getData = async () => {
    try {
      const { data } = await api.get(
        `/marketingCampaign/${marketingCampaignId}`
      );
      setMarketingCampaign((prevState) => {
        return {
          ...prevState,
          ...data,
          keywords: JSON.parse(data.keywords) || [],
        };
      });
    } catch (err) {
      toastError(err);
    }
  };

  useEffect(() => {
    (async () => {
      if (!marketingCampaignId) return;
      getData();
      // try {
      //   const { data } = await api.get(
      //     `/marketingCampaign/${marketingCampaignId}`
      //   );
      //   setMarketingCampaign((prevState) => {
      //     return { ...prevState, ...data };
      //   });
      // } catch (err) {
      //   toastError(err);
      // }
    })();
    return () => {
      setMarketingCampaign(initialState);
    };
  }, [marketingCampaignId, open]);

  const handleClose = () => {
    onClose();
    setMarketingCampaign(initialState);
  };

  const handleSaveMarketingCampaign = async (values) => {
    try {
      console.log("values to submit", values);

      if (marketingCampaignId) {
        await api.put(`/marketingCampaign/${marketingCampaignId}`, values);
      } else {
        await api.post("/marketingCampaign", values);
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
      <ConfirmationModal
        title={confirmationModalTitle}
        open={confirmationModalOpen}
        onClose={() => setConfirmationModalOpen(false)}
        onConfirm={() => confirmationModalHandler()}
      ></ConfirmationModal>

      <MarketingCampaignAutomaticMessage
        open={marketingCampaignAutomaticMessageModalOpen}
        onClose={() => {
          setMarketingCampaignAutomaticMessageModalOpen(false);
          setSelectedMarketingCampaignAutomaticMessage(null);
          getData();
        }}
        marketingCampaignAutomaticMessageId={
          selectedMarketingCampaignAutomaticMessage?.id
        }
        marketingCampaignId={marketingCampaignId}
      />

      <MarketingMessagingCampaignModal
        open={marketingMessagingCampaignModalOpen}
        onClose={() => {
          setMarketingMessagingCampaignModalOpen(false);
          getData();
        }}
        marketingMessagingCampaignId={selectedMarketingMessagingCampaign?.id}
        marketingCampaignId={marketingCampaignId}
      />

      <SendMarketingMessagingCampaign
        open={sendMarketingMessagingCampaignOpen}
        onClose={() => {
          setSendMarketingMessagingCampaignOpen(false);
          getData();
        }}
        marketingMessagingCampaignId={selectedMarketingMessagingCampaign?.id}
      />

      {/* {JSON.stringify(selectedMarketingCampaignAutomaticMessage?.id)} */}

      <Dialog open={open} onClose={handleClose} scroll="paper" maxWidth="md">
        <DialogTitle>
          {marketingCampaignId ? `Editar campaña` : `Crear campaña`}
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
          <Tab label="CAMPAÑA DE MENSAJES" disabled={!marketingCampaignId} />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Formik
            initialValues={marketingCampaign}
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
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "1rem",
                      width: "100%",
                    }}
                  >
                    <div style={{ margin: 0 }}>Esta activa</div>

                    <Switch
                      checked={values.isActive}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      name="isActive"
                      color="primary"
                      inputProps={{ "aria-label": "primary checkbox" }}
                    />
                  </div>
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

                  <Autocomplete
                    multiple
                    value={values.keywords}
                    options={[]}
                    style={{ marginBottom: "2rem" }}
                    clearOnBlur
                    autoHighlight
                    freeSolo
                    clearOnEscape
                    margin="dense"
                    getOptionLabel={(option) => option.replace(/Añadir: /, "")}
                    renderOption={(option) => {
                      return (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                        >
                          {option}
                        </div>
                      );
                    }}
                    filterOptions={(options, params) => {
                      if (params.inputValue) {
                        return [...options, `Añadir: ${params.inputValue}`];
                      }
                      return [];
                    }}
                    onChange={(e, newValue) => {
                      setFieldValue(
                        "keywords",
                        newValue.map((keyword) =>
                          keyword.replace(/Añadir: /, "")
                        )
                      );
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label={"Keywords"}
                        variant="outlined"
                        autoFocus
                        margin="dense"
                      />
                    )}
                  />

                  {marketingCampaignId && (
                    <>
                      <div style={{ display: "flex", justifyContent: "end" }}>
                        <Button
                          variant="contained"
                          color="primary"
                          onClick={() => {
                            setMarketingCampaignAutomaticMessageModalOpen(true);
                            setSelectedMarketingCampaignAutomaticMessage(null);
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
                            {marketingCampaign.marketingCampaignAutomaticMessages?.map(
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
                                    {/* {JSON.stringify(message.id)} */}
                                    <IconButton
                                      size="small"
                                      onClick={() => {
                                        setMarketingCampaignAutomaticMessageModalOpen(
                                          true
                                        );
                                        setSelectedMarketingCampaignAutomaticMessage(
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
                    {marketingCampaignId
                      ? `${i18n.t("queueModal.buttons.okEdit")}`
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
            <div
              style={{
                display: "flex",
                justifyContent: "end",
              }}
            >
              <Button
                variant="contained"
                color="primary"
                onClick={() => {
                  setMarketingMessagingCampaignModalOpen(true);
                  setSelectedMarketingMessagingCampaign(null);
                }}
              >
                Crear campaña de mensajes
              </Button>
            </div>

            <Table size="medium">
              <TableHead>
                <TableRow>
                  <TableCell align="center">Creación</TableCell>
                  <TableCell align="center">Nombre</TableCell>
                  <TableCell align="center">Veces envidadas</TableCell>
                  <TableCell align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <>
                  {marketingCampaign.marketingMessagingCampaigns?.map(
                    (messagingCampaign) => (
                      <TableRow key={messagingCampaign.id}>
                        <TableCell align="center">
                          {format(
                            new Date(messagingCampaign.createdAt),
                            "dd-MM-yyyy"
                          )}
                        </TableCell>
                        <TableCell align="center">
                          {messagingCampaign.name}
                        </TableCell>
                        <TableCell align="center">
                          {messagingCampaign.timesSent}
                        </TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setMarketingMessagingCampaignModalOpen(true);
                              setSelectedMarketingMessagingCampaign(
                                messagingCampaign
                              );
                            }}
                          >
                            <Edit />
                          </IconButton>

                          <IconButton
                            size="small"
                            onClick={async () => {
                              setConfirmationModalTitle(
                                "¿Estás seguro de que deseas eliminar esta campaña de mensajes?"
                              );
                              setConfirmationModalOpen(true);
                              setConfirmationModalHandler(() => async () => {
                                try {
                                  await api.delete(
                                    `/marketingMessagingCampaign/${messagingCampaign.id}`
                                  );
                                  toast.success(
                                    "MarketingMessagingCampaign deleted successfully"
                                  );
                                  getData();
                                } catch (err) {
                                  console.log(err);
                                  toastError(
                                    "Error deleting MarketingCampaignAutomaticMessage"
                                  );
                                }
                              });
                            }}
                          >
                            <DeleteOutline />
                          </IconButton>

                          <ButtonWithSpinner
                            variant="contained"
                            type="submit"
                            color="primary"
                            loading={false}
                            onClick={() => {
                              setSendMarketingMessagingCampaignOpen(true);
                              setSelectedMarketingMessagingCampaign(
                                messagingCampaign
                              );
                            }}
                          >
                            Enviar
                          </ButtonWithSpinner>
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

export default MarketingCampaignModal;
