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
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import TextField from "@material-ui/core/TextField";
import { DeleteOutline, Edit } from "@material-ui/icons";
import ModalImageCors from "../ModalImageCors";

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

      <Dialog open={open} onClose={handleClose} scroll="paper" maxWidth="md">
        <DialogTitle>
          {marketingMessagingCampaignId
            ? `Editar campaña de mensajes`
            : `Crear campaña de mensajes`}
        </DialogTitle>

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
      </Dialog>
    </div>
  );
};

export default MarketingMessagingCampaignModal;
