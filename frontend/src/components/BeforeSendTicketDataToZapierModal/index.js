import React, { useEffect, useState } from "react";

import { Field, Form, Formik } from "formik";
import { toast } from "react-toastify";

import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import { green } from "@material-ui/core/colors";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import FormControl from "@material-ui/core/FormControl";
import FormHelperText from "@material-ui/core/FormHelperText";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import Select from "@material-ui/core/Select";
import TextField from "@material-ui/core/TextField";
import * as Yup from "yup";

import { makeStyles } from "@material-ui/core/styles";

import { i18n } from "../../translate/i18n";

import { Divider } from "@material-ui/core";
import toastError from "../../errors/toastError";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },
  textField: {
    // marginRight: theme.spacing(1),
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

const ContactSchema = Yup.object().shape({
  contactName: Yup.string()
    .min(2, "Too Short!")
    .max(50, "Too Long!")
    .required("Required"),
  contactEmail: Yup.string().email("Invalid email").required("Required"),
  contactCountryId: Yup.number().moreThan(0).required("Required"),
  ticketCampaignId: Yup.number().moreThan(0).required("Required"),
  NOMBRE_NEGOCIO: Yup.string().required("Required"),
  CALIDAD_MARKETING: Yup.string().required("Required"),
  CALIDAD_COMERCIAL: Yup.string().required("Required"),
});

const BeforeSendTicketDataToZapierModal = ({
  open,
  onClose,
  ticketId,
  loggerUserName,
}) => {
  const classes = useStyles();

  const initialState = {
    contactName: "",
    contactNumber: "",
    contactEmail: "",
    contactCountryId: "",
    contactCountry: "",
    ticketCampaignId: "",
    ticketCampaign: "",
    userId: "",
    userName: "",
    userHubspotId: "",
    NOMBRE_NEGOCIO: "",
    CALIDAD_MARKETING: "",
    CALIDAD_COMERCIAL: "",
  };

  const [ticketDataToSendToZapier, setTicketDataToSendToZapier] =
    useState(initialState);
  const [marketingCampaigns, setMarketingCampaigns] = useState([]);
  const [selectMarketingCampaign, setSelectMarketingCampaign] = useState(0);
  const [countries, setCountries] = useState([]);
  const [chooseCountryId, setChooseCountryId] = useState(null);

  useEffect(() => {
    if (!open) {
      setTicketDataToSendToZapier(initialState);
      return;
    }

    (async () => {
      try {
        const { data: marketingCampaigns } = await api.get(
          "/marketingCampaigns"
        );
        setMarketingCampaigns(marketingCampaigns);

        const { data: countriesData } = await api.get(`/countries`);
        if (countriesData?.countries?.length > 0) {
          setCountries(countriesData.countries);
        }

        const { data } = await api.post(`/extra/getTicketDataToSendToZapier`, {
          ticketId: ticketId,
        });

        setTicketDataToSendToZapier({
          ...data,
          contactCountryId: data.contactCountryId || "",
          ticketCampaignId: data.ticketCampaignId || "",
          NOMBRE_NEGOCIO:
            data.extraInfo.find((info) => info.name === "NOMBRE_NEGOCIO")
              ?.value || "",
          CALIDAD_MARKETING:
            data.extraInfo.find((info) => info.name === "CALIDAD_MARKETING")
              ?.value || "",
          CALIDAD_COMERCIAL:
            data.extraInfo.find((info) => info.name === "CALIDAD_COMERCIAL")
              ?.value || "",
        });
      } catch (err) {
        console.log("err", err);
        toast.error("Error al cargar");
      }
    })();
  }, [ticketId, open]);

  const handleClose = () => {
    onClose();
    setTicketDataToSendToZapier(initialState);
  };

  const handleSendToZapier = async (values) => {
    try {
      console.log("values to submit", { ...values, ticketId, loggerUserName });

      values.extraInfo = values.extraInfo.filter(
        (info) =>
          info.name !== "NOMBRE_NEGOCIO" &&
          info.name !== "CALIDAD_MARKETING" &&
          info.name !== "CALIDAD_COMERCIAL"
      );

      values.extraInfo = [
        ...values.extraInfo,
        {
          name: "NOMBRE_NEGOCIO",
          value: values.NOMBRE_NEGOCIO,
        },
        {
          name: "CALIDAD_MARKETING",
          value: values.CALIDAD_MARKETING,
        },
        {
          name: "CALIDAD_COMERCIAL",
          value: values.CALIDAD_COMERCIAL,
        },
      ];
      await api.post("/extra/sendTicketDataToZapier", {
        ...values,
        ticketId,
        loggerUserName,
      });
      toast.success("Datos creados en Hubspot correctamente");
      handleClose();
    } catch (error) {
      console.log("handleSendToZapier error", error);
      toastError("Error al crear los datos en Hubspot");
    }
  };

  return (
    <div className={classes.root}>
      <Dialog open={open} onClose={handleClose} scroll="paper">
        <DialogTitle>Datos a crear en Hubspot</DialogTitle>
        <Formik
          initialValues={{
            ...ticketDataToSendToZapier,
          }}
          enableReinitialize={true}
          validationSchema={ContactSchema}
          onSubmit={(values, actions) => {
            setTimeout(() => {
              handleSendToZapier(values);
              actions.setSubmitting(false);
            }, 400);
          }}
        >
          {({
            values,
            touched,
            handleChange,
            handleBlur,
            errors,
            isSubmitting,
          }) => (
            <Form>
              <DialogContent dividers>
                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    marginBottom: 16,
                  }}
                >
                  <Field
                    as={TextField}
                    label={"Nombre del contacto"}
                    autoFocus
                    name="contactName"
                    error={touched.contactName && Boolean(errors.contactName)}
                    helperText={touched.contactName && errors.contactName}
                    variant="outlined"
                    className={classes.textField}
                  />
                  <Field
                    as={TextField}
                    label={"Número del contacto"}
                    disabled
                    autoFocus
                    name="contactNumber"
                    error={
                      touched.contactNumber && Boolean(errors.contactNumber)
                    }
                    helperText={touched.contactNumber && errors.contactNumber}
                    variant="outlined"
                    className={classes.textField}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    marginBottom: 16,
                  }}
                >
                  <Field
                    as={TextField}
                    label={"Correo del contacto"}
                    autoFocus
                    name="contactEmail"
                    error={touched.contactEmail && Boolean(errors.contactEmail)}
                    helperText={touched.contactEmail && errors.contactEmail}
                    variant="outlined"
                    className={classes.textField}
                  />

                  <FormControl
                    variant="outlined"
                    error={
                      touched.contactCountryId &&
                      Boolean(errors.contactCountryId)
                    }
                    className={classes.textField}
                  >
                    <InputLabel id="contactCountry-label">
                      País del contacto
                    </InputLabel>
                    <Select
                      labelId="contactCountry-label"
                      id="contactCountryId"
                      name="contactCountryId"
                      value={values.contactCountryId}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      label="País del contacto"
                    >
                      {countries?.length > 0 &&
                        countries.map((c) => (
                          <MenuItem dense key={c.id} value={c.id}>
                            {c.name}
                          </MenuItem>
                        ))}
                    </Select>
                    {touched.contactCountryId && errors.contactCountryId ? (
                      <>{errors.contactCountryId}</>
                    ) : null}
                  </FormControl>
                </div>

                <Divider
                  style={{
                    marginBottom: 16,
                  }}
                />

                <FormControl
                  fullWidth
                  variant="outlined"
                  error={
                    touched.ticketCampaignId && Boolean(errors.ticketCampaignId)
                  }
                  style={{
                    marginBottom: 16,
                  }}
                >
                  <InputLabel id="Campaña_del_ticket-label">
                    Campaña del ticket
                  </InputLabel>
                  <Select
                    labelId="ticketCampaign-label"
                    id="ticketCampaign"
                    name="ticketCampaignId"
                    value={values.ticketCampaignId}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    label="Campaña del ticket"
                  >
                    {marketingCampaigns.map((mc) => (
                      <MenuItem key={mc.id} value={mc.id}>
                        {mc.name}
                      </MenuItem>
                    ))}
                  </Select>
                  {touched.ticketCampaignId && errors.ticketCampaignId ? (
                    <>{errors.ticketCampaignId}</>
                  ) : null}
                </FormControl>

                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    marginBottom: 16,
                  }}
                >
                  <Field
                    as={TextField}
                    label={"NOMBRE NEGOCIO"}
                    autoFocus
                    name="NOMBRE_NEGOCIO"
                    error={
                      touched.NOMBRE_NEGOCIO && Boolean(errors.NOMBRE_NEGOCIO)
                    }
                    helperText={touched.NOMBRE_NEGOCIO && errors.NOMBRE_NEGOCIO}
                    variant="outlined"
                    className={classes.textField}
                  />
                </div>

                <FormControl
                  fullWidth
                  margin="dense"
                  variant="outlined"
                  error={
                    touched.CALIDAD_MARKETING &&
                    Boolean(errors.CALIDAD_MARKETING)
                  }
                  style={{
                    marginBottom: 16,
                  }}
                >
                  <InputLabel id="CALIDAD_MARKETING-label">
                    CALIDAD MARKETING
                  </InputLabel>
                  <Select
                    labelId="CALIDAD_MARKETING-label"
                    id="CALIDAD_MARKETING"
                    name="CALIDAD_MARKETING"
                    value={values.CALIDAD_MARKETING}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    label="CALIDAD MARKETING"
                  >
                    <MenuItem value="Regular">Regular</MenuItem>
                    <MenuItem value="Malo">Malo</MenuItem>
                    <MenuItem value="Bueno">Bueno</MenuItem>
                  </Select>
                  {touched.CALIDAD_MARKETING && errors.CALIDAD_MARKETING ? (
                    <FormHelperText>{errors.CALIDAD_MARKETING}</FormHelperText>
                  ) : null}
                </FormControl>

                <FormControl
                  fullWidth
                  margin="dense"
                  variant="outlined"
                  error={
                    touched.CALIDAD_COMERCIAL &&
                    Boolean(errors.CALIDAD_COMERCIAL)
                  }
                  style={{
                    marginBottom: 16,
                  }}
                >
                  <InputLabel id="CALIDAD_COMERCIAL-label">
                    CALIDAD COMERCIAL
                  </InputLabel>
                  <Select
                    labelId="CALIDAD_COMERCIAL-label"
                    id="CALIDAD_COMERCIAL"
                    name="CALIDAD_COMERCIAL"
                    value={values.CALIDAD_COMERCIAL}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    label="CALIDAD COMERCIAL"
                  >
                    <MenuItem value="Regular">Regular</MenuItem>
                    <MenuItem value="Malo">Malo</MenuItem>
                    <MenuItem value="Bueno">Bueno</MenuItem>
                  </Select>
                  {touched.CALIDAD_COMERCIAL && errors.CALIDAD_COMERCIAL ? (
                    <FormHelperText>{errors.CALIDAD_COMERCIAL}</FormHelperText>
                  ) : null}
                </FormControl>
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
                  Crear en Hubspot
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

export default BeforeSendTicketDataToZapierModal;
