import React, { useEffect, useState } from "react";

import { Field, Form, Formik } from "formik";
import { toast } from "react-toastify";

import { Box, FormHelperText } from "@material-ui/core";
import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import { green } from "@material-ui/core/colors";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import Select from "@material-ui/core/Select";
import { makeStyles } from "@material-ui/core/styles";
import TextField from "@material-ui/core/TextField";
import { i18n } from "../../translate/i18n";

import toastError from "../../errors/toastError";
import api from "../../services/api";

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

const MessagingCampaignMessageModal = ({
  open,
  onClose,
  messagingCampaignId,
  messagingCampaignMessageId,
}) => {
  const classes = useStyles();

  const initialState = {
    order: 1,
    body: "",
    mediaType: "text",
    mediaUrl: "",
  };

  const [messageCampaign, setMessagingCampaignMessageModal] =
    useState(initialState);

  useEffect(() => {
    console.log("messagingCampaignMessageId", messagingCampaignMessageId);

    (async () => {
      if (!messagingCampaignMessageId) return;
      try {
        const { data } = await api.get(
          `/messagingCampaignMessages/${messagingCampaignMessageId}`
        );
        setMessagingCampaignMessageModal((prevState) => {
          return { ...prevState, ...data };
        });
      } catch (err) {
        toastError(err);
      }
    })();
    return () => {
      setMessagingCampaignMessageModal(initialState);
    };
  }, [messagingCampaignMessageId, open]);

  const handleClose = () => {
    onClose();
    setMessagingCampaignMessageModal(initialState);
  };

  const handleSaveMessagingCampaignMessageModal = async (values) => {
    try {
      values = {
        ...values,
        ...(messagingCampaignId && { messagingCampaignId }),
      };
      console.log("values to submit", values);

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

      if (messagingCampaignMessageId) {
        await api.put(
          `/messagingCampaignMessages/${messagingCampaignMessageId}`,
          formData
        );
      } else {
        // await api.post("/messageCampaign", values);
        await api.post("/messagingCampaignMessages", formData);
      }
      toast.success("MessagingCampaignMessageModal saved successfully");
      handleClose();
    } catch (err) {
      console.log(err);
      toastError("Error saving MessagingCampaignMessageModal");
    }
  };

  return (
    <div className={classes.root}>
      <Dialog open={open} onClose={handleClose} scroll="paper">
        <DialogTitle>
          {messagingCampaignMessageId
            ? `Editar mensaje de campaña`
            : `Crear mensaje de campaña`}
        </DialogTitle>
        <Formik
          initialValues={messageCampaign}
          enableReinitialize={true}
          onSubmit={(values, actions) => {
            console.log("values", values);

            setTimeout(() => {
              handleSaveMessagingCampaignMessageModal(values);
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
                {/* {JSON.stringify(values)} */}
                <Field
                  as={TextField}
                  label={"Orden"}
                  type="number"
                  fullWidth
                  autoFocus
                  name="order"
                  error={touched.order && Boolean(errors.order)}
                  helperText={touched.order && errors.order}
                  variant="outlined"
                  className={classes.textField}
                  style={{ marginBottom: "2rem" }}
                />

                <FormControl
                  variant="outlined"
                  error={touched.mediaType && Boolean(errors.mediaType)}
                  className={classes.textField}
                  style={{
                    width: "100%",
                  }}
                >
                  <InputLabel id="mediaType-label">Tipo de mensaje</InputLabel>
                  <Select
                    labelId="mediaType-label"
                    id="mediaType"
                    name="mediaType"
                    value={values.mediaType}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    label="Tipo de mensaje"
                  >
                    <MenuItem dense value={"text"}>
                      Texto
                    </MenuItem>
                    <MenuItem dense value={"file"}>
                      Archivo (imagen, video, audio)
                    </MenuItem>
                  </Select>
                  {touched.mediaType && errors.mediaType ? (
                    <>{errors.mediaType}</>
                  ) : null}
                </FormControl>

                {values.mediaType === "text" && (
                  <Field
                    as={TextField}
                    label={"Texto"}
                    multiline
                    minRows={3}
                    fullWidth
                    autoFocus
                    name="body"
                    error={touched.body && Boolean(errors.body)}
                    helperText={touched.body && errors.body}
                    variant="outlined"
                    className={classes.textField}
                    style={{ marginBottom: "2rem" }}
                  />
                )}

                {values.mediaType === "file" && (
                  <Box margin="normal">
                    <input
                      id="file"
                      name="file"
                      type="file"
                      onChange={(event) => {
                        // Establece el archivo en los valores de Formik
                        setFieldValue("file", event.currentTarget.files[0]);
                      }}
                      style={{ display: "block", marginBottom: "8px" }}
                    />
                    {touched.file && errors.file ? (
                      <FormHelperText error>{errors.file}</FormHelperText>
                    ) : null}
                  </Box>
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
                  {messagingCampaignMessageId
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
      </Dialog>
    </div>
  );
};

export default MessagingCampaignMessageModal;
