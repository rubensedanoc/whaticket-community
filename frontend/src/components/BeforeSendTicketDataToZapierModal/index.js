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

import Autocomplete, {
  createFilterOptions,
} from "@material-ui/lab/Autocomplete";

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
  TIENE_RESTAURANTE: Yup.string(),
  TIPO_RESTAURANTE: Yup.string(),
  TOMA_LA_DECISION: Yup.string(),
  CARGO: Yup.string(),
  YA_USA_SISTEMA: Yup.string(),
  SISTEMA_ACTUAL: Yup.string(),
  NUM_SUCURSALES: Yup.string(),
  NUM_MESAS: Yup.string(),
  CUANTO_PAGA: Yup.string(),
  COMO_SE_ENTERO: Yup.string(),
  DOLOR_1: Yup.string(),
  DOLOR_2: Yup.string(),
});

const filter = createFilterOptions();

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
    TIENE_RESTAURANTE: "",
    TIPO_RESTAURANTE: "",
    TOMA_LA_DECISION: "",
    CARGO: "",
    YA_USA_SISTEMA: "",
    SISTEMA_ACTUAL: "",
    NUM_SUCURSALES: "",
    NUM_MESAS: "",
    CUANTO_PAGA: "",
    COMO_SE_ENTERO: "",
    DOLOR_1: "",
    DOLOR_2: "",
  };

  const [ticketDataToSendToZapier, setTicketDataToSendToZapier] =
    useState(initialState);
  const [marketingCampaigns, setMarketingCampaigns] = useState([]);
  const [selectMarketingCampaign, setSelectMarketingCampaign] = useState(0);
  const [countries, setCountries] = useState([]);
  const [chooseCountryId, setChooseCountryId] = useState(null);
  const [allSISTEMA_ACTUALOptions, setAllSISTEMA_ACTUALOptions] = useState([]);
  const [allCOMO_SE_ENTEROOptions, setAllCOMO_SE_ENTEROOptions] = useState([]);
  const [allDOLOROptions, setAllDOLOROptions] = useState([]);

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
          contactEmail:
            data.contactEmail || `${data.contactNumber}@restaurant.pe`,
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
          TIENE_RESTAURANTE:
            data.extraInfo.find((info) => info.name === "TIENE_RESTAURANTE")
              ?.value || "",
          TIPO_RESTAURANTE:
            data.extraInfo.find((info) => info.name === "TIPO_RESTAURANTE")
              ?.value || "",
          TOMA_LA_DECISION:
            data.extraInfo.find((info) => info.name === "TOMA_LA_DECISION")
              ?.value || "",
          CARGO:
            data.extraInfo.find((info) => info.name === "CARGO")?.value || "",
          YA_USA_SISTEMA:
            data.extraInfo.find((info) => info.name === "YA_USA_SISTEMA")
              ?.value || "",
          SISTEMA_ACTUAL:
            data.extraInfo.find((info) => info.name === "SISTEMA_ACTUAL")
              ?.value || "",
          NUM_SUCURSALES:
            data.extraInfo.find((info) => info.name === "NUM_SUCURSALES")
              ?.value || "",
          NUM_MESAS:
            data.extraInfo.find((info) => info.name === "NUM_MESAS")?.value ||
            "",
          CUANTO_PAGA:
            data.extraInfo.find((info) => info.name === "CUANTO_PAGA")?.value ||
            "",
          COMO_SE_ENTERO:
            data.extraInfo.find((info) => info.name === "COMO_SE_ENTERO")
              ?.value || "",
          DOLOR_1:
            data.extraInfo.find((info) => info.name === "DOLOR_1")?.value || "",
          DOLOR_2:
            data.extraInfo.find((info) => info.name === "DOLOR_2")?.value || "",
        });

        setAllSISTEMA_ACTUALOptions(data.allSISTEMA_ACTUALOptions);
        setAllCOMO_SE_ENTEROOptions(data.allCOMO_SE_ENTEROOptions);
        setAllDOLOROptions(data.allDOLOROptions);
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

  const handleSendToZapier = async (values, onlyUpdateInfo = false) => {
    try {
      console.log(
        "values to submit",
        JSON.parse(JSON.stringify({ ...values, ticketId, loggerUserName }))
      );

      values.extraInfo = values.extraInfo.filter(
        (info) =>
          info.name !== "NOMBRE_NEGOCIO" &&
          info.name !== "CALIDAD_MARKETING" &&
          info.name !== "CALIDAD_COMERCIAL" &&
          info.name !== "TIENE_RESTAURANTE" &&
          info.name !== "TIPO_RESTAURANTE" &&
          info.name !== "TOMA_LA_DECISION" &&
          info.name !== "CARGO" &&
          info.name !== "YA_USA_SISTEMA" &&
          info.name !== "SISTEMA_ACTUAL" &&
          info.name !== "NUM_SUCURSALES" &&
          info.name !== "NUM_MESAS" &&
          info.name !== "CUANTO_PAGA" &&
          info.name !== "COMO_SE_ENTERO" &&
          info.name !== "DOLOR_1" &&
          info.name !== "DOLOR_2"
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
        {
          name: "TIENE_RESTAURANTE",
          value: values.TIENE_RESTAURANTE,
        },
        {
          name: "TIPO_RESTAURANTE",
          value: values.TIPO_RESTAURANTE,
        },
        {
          name: "TOMA_LA_DECISION",
          value: values.TOMA_LA_DECISION,
        },
        {
          name: "CARGO",
          value: values.CARGO,
        },
        {
          name: "YA_USA_SISTEMA",
          value: values.YA_USA_SISTEMA,
        },
        {
          name: "SISTEMA_ACTUAL",
          value: values.SISTEMA_ACTUAL,
        },
        {
          name: "NUM_SUCURSALES",
          value: values.NUM_SUCURSALES,
        },
        {
          name: "NUM_MESAS",
          value: values.NUM_MESAS,
        },
        {
          name: "CUANTO_PAGA",
          value: values.CUANTO_PAGA,
        },
        {
          name: "COMO_SE_ENTERO",
          value: values.COMO_SE_ENTERO,
        },
        {
          name: "DOLOR_1",
          value: values.DOLOR_1,
        },
        {
          name: "DOLOR_2",
          value: values.DOLOR_2,
        },
      ];

      console.log("values to submit", { ...values, ticketId, loggerUserName });

      await api.post("/extra/sendTicketDataToZapier", {
        ...values,
        ticketId,
        loggerUserName,
        onlyUpdateInfo,
      });
      toast.success(
        onlyUpdateInfo
          ? "Datos guardados correctamente"
          : "Datos enviados a Trazabilidad correctamente"
      );
      handleClose();
    } catch (error) {
      console.log("handleSendToZapier error", error);
      toast.error(`Error al crear los datos en Trazabilidad ${error.message}`);
    }
  };

  return (
    <div className={classes.root}>
      <Dialog
        open={open}
        onClose={handleClose}
        scroll="paper"
        maxWidth="xl"
        con
      >
        <DialogTitle>Datos a crear en Trazabilidad</DialogTitle>
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
            setFieldValue,
          }) => (
            <Form>
              <DialogContent dividers>
                <div style={{ display: "flex", gap: "1rem", width: "55rem" }}>
                  <div>
                    <div
                      style={{
                        display: "flex",
                        gap: 16,
                        marginBottom: 12,
                      }}
                    >
                      <Field
                        as={TextField}
                        label={"Nombre del contacto"}
                        autoFocus
                        name="contactName"
                        error={
                          touched.contactName && Boolean(errors.contactName)
                        }
                        helperText={touched.contactName && errors.contactName}
                        variant="outlined"
                        margin="dense"
                        // className={classes.textField}
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
                        helperText={
                          touched.contactNumber && errors.contactNumber
                        }
                        variant="outlined"
                        margin="dense"
                        // className={classes.textField}
                      />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 16,
                        marginBottom: 12,
                      }}
                    >
                      <Field
                        as={TextField}
                        label={"Correo del contacto"}
                        autoFocus
                        name="contactEmail"
                        error={
                          touched.contactEmail && Boolean(errors.contactEmail)
                        }
                        helperText={touched.contactEmail && errors.contactEmail}
                        variant="outlined"
                        margin="dense"
                        className={classes.textField}
                      />

                      <FormControl
                        variant="outlined"
                        margin="dense"
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
                          <FormHelperText>
                            {errors.contactCountryId}
                          </FormHelperText>
                        ) : null}
                      </FormControl>
                    </div>

                    <Divider
                      style={{
                        marginBottom: 12,
                      }}
                    />

                    <FormControl
                      fullWidth
                      variant="outlined"
                      margin="dense"
                      error={
                        touched.ticketCampaignId &&
                        Boolean(errors.ticketCampaignId)
                      }
                      // className={classes.textField}
                      style={{
                        marginBottom: 12,
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
                        <FormHelperText>
                          {errors.ticketCampaignId}
                        </FormHelperText>
                      ) : null}
                    </FormControl>

                    <div
                      style={{
                        display: "flex",
                        gap: 16,
                        marginBottom: 12,
                      }}
                    >
                      <Field
                        as={TextField}
                        label={"Nombre del negocio"}
                        autoFocus
                        name="NOMBRE_NEGOCIO"
                        error={
                          touched.NOMBRE_NEGOCIO &&
                          Boolean(errors.NOMBRE_NEGOCIO)
                        }
                        helperText={
                          touched.NOMBRE_NEGOCIO && errors.NOMBRE_NEGOCIO
                        }
                        variant="outlined"
                        margin="dense"
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
                        marginBottom: 12,
                      }}
                    >
                      <InputLabel id="CALIDAD_MARKETING-label">
                        Calidad de marketing
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
                        <MenuItem value="Sin Respuesta">Sin Respuesta</MenuItem>
                        <MenuItem value="Regular">Regular</MenuItem>
                        <MenuItem value="Malo">Malo</MenuItem>
                        <MenuItem value="Bueno">Bueno</MenuItem>
                      </Select>
                      {touched.CALIDAD_MARKETING && errors.CALIDAD_MARKETING ? (
                        <FormHelperText>
                          {errors.CALIDAD_MARKETING}
                        </FormHelperText>
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
                        marginBottom: 12,
                      }}
                    >
                      <InputLabel id="CALIDAD_COMERCIAL-label">
                        Calidad comercial
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
                        <MenuItem value="Sin Respuesta">Sin Respuesta</MenuItem>
                        <MenuItem value="Regular">Regular</MenuItem>
                        <MenuItem value="Malo">Malo</MenuItem>
                        <MenuItem value="Bueno">Bueno</MenuItem>
                      </Select>
                      {touched.CALIDAD_COMERCIAL && errors.CALIDAD_COMERCIAL ? (
                        <FormHelperText>
                          {errors.CALIDAD_COMERCIAL}
                        </FormHelperText>
                      ) : null}
                    </FormControl>
                  </div>

                  <Divider flexItem orientation="vertical" />

                  <div>
                    <div
                      style={{
                        display: "flex",
                        gap: 16,
                        marginBottom: 12,
                      }}
                    >
                      <FormControl
                        margin="dense"
                        variant="outlined"
                        className={classes.textField}
                        error={
                          touched.TIENE_RESTAURANTE &&
                          Boolean(errors.TIENE_RESTAURANTE)
                        }
                      >
                        <InputLabel id="TIENE_RESTAURANTE-label">
                          Tiene restaurante
                        </InputLabel>
                        <Select
                          labelId="TIENE_RESTAURANTE-label"
                          id="TIENE_RESTAURANTE"
                          name="TIENE_RESTAURANTE"
                          value={values.TIENE_RESTAURANTE}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          label="TIENE RESTAURANTE"
                        >
                          <MenuItem value="SI">Si</MenuItem>
                          <MenuItem value="NO">No</MenuItem>
                          <MenuItem value="POR_APERTURAR">
                            Por Aperturar
                          </MenuItem>
                        </Select>
                        {touched.TIENE_RESTAURANTE &&
                        errors.TIENE_RESTAURANTE ? (
                          <FormHelperText>
                            {errors.TIENE_RESTAURANTE}
                          </FormHelperText>
                        ) : null}
                      </FormControl>

                      <FormControl
                        margin="dense"
                        variant="outlined"
                        className={classes.textField}
                        error={
                          touched.TIPO_RESTAURANTE &&
                          Boolean(errors.TIPO_RESTAURANTE)
                        }
                      >
                        <InputLabel id="TIPO_RESTAURANTE-label">
                          Tipo de restaurante
                        </InputLabel>
                        <Select
                          labelId="TIPO_RESTAURANTE-label"
                          id="TIPO_RESTAURANTE"
                          name="TIPO_RESTAURANTE"
                          value={values.TIPO_RESTAURANTE}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          label="TIPO RESTAURANTE"
                        >
                          <MenuItem value="Variado">Variado</MenuItem>
                          <MenuItem value="Comida Criolla">
                            Comida Criolla
                          </MenuItem>
                          <MenuItem value="Comida Marina">
                            Comida Marina
                          </MenuItem>
                          <MenuItem value="Pizzas y Pastas">
                            Pizzas y Pastas
                          </MenuItem>
                          <MenuItem value="Comida China">Comida China</MenuItem>
                          <MenuItem value="Comida vegetariana">
                            Comida vegetariana
                          </MenuItem>
                          <MenuItem value="Sushi & Makis">
                            Sushi & Makis
                          </MenuItem>
                          <MenuItem value="Fast Food">Fast Food</MenuItem>
                          <MenuItem value="Panaderias">Panaderias</MenuItem>
                          <MenuItem value="Pastelerías">Pastelerías</MenuItem>
                          <MenuItem value="Juguería">Juguería</MenuItem>
                          <MenuItem value="Cafeterías">Cafeterías</MenuItem>
                          <MenuItem value="Restobar">Restobar</MenuItem>
                          <MenuItem value="Discoteca">Discoteca</MenuItem>
                          <MenuItem value="Mini Market">Mini Market</MenuItem>
                          <MenuItem value="Pollerías">Pollerías</MenuItem>
                          <MenuItem value="Carnes y Parrillas">
                            Carnes y Parrillas
                          </MenuItem>
                          <MenuItem value="Comida Internacional">
                            Comida Internacional
                          </MenuItem>
                          <MenuItem value="Menú">Menú</MenuItem>
                          <MenuItem value="Heladería">Heladería</MenuItem>
                        </Select>
                        {touched.TIPO_RESTAURANTE && errors.TIPO_RESTAURANTE ? (
                          <FormHelperText>
                            {errors.TIPO_RESTAURANTE}
                          </FormHelperText>
                        ) : null}
                      </FormControl>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 16,
                        marginBottom: 12,
                      }}
                    >
                      <FormControl
                        margin="dense"
                        variant="outlined"
                        className={classes.textField}
                        error={
                          touched.TOMA_LA_DECISION &&
                          Boolean(errors.TOMA_LA_DECISION)
                        }
                      >
                        <InputLabel id="TOMA_LA_DECISION-label">
                          Toma la decisión
                        </InputLabel>
                        <Select
                          labelId="TOMA_LA_DECISION-label"
                          id="TOMA_LA_DECISION"
                          name="TOMA_LA_DECISION"
                          value={values.TOMA_LA_DECISION}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          label="TOMA LA DECISIÓN"
                        >
                          <MenuItem value="SI">Si</MenuItem>
                          <MenuItem value="NO">No</MenuItem>
                        </Select>
                        {touched.TOMA_LA_DECISION && errors.TOMA_LA_DECISION ? (
                          <FormHelperText>
                            {errors.TOMA_LA_DECISION}
                          </FormHelperText>
                        ) : null}
                      </FormControl>

                      <FormControl
                        margin="dense"
                        variant="outlined"
                        className={classes.textField}
                        error={touched.CARGO && Boolean(errors.CARGO)}
                        // style={{
                        //   marginBottom: 12,
                        // }}
                      >
                        <InputLabel id="CARGO-label">Cargo</InputLabel>
                        <Select
                          labelId="CARGO-label"
                          id="CARGO"
                          name="CARGO"
                          value={values.CARGO}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          label="CARGO"
                        >
                          <MenuItem value="Dueño">Dueño</MenuItem>
                          <MenuItem value="Gerente">Gerente</MenuItem>
                          <MenuItem value="Cajero">Cajero</MenuItem>
                          <MenuItem value="Socio">Socio</MenuItem>
                          <MenuItem value="Cocinero">Cocinero</MenuItem>
                          <MenuItem value="Contador">Contador</MenuItem>
                          <MenuItem value="Mozo">Mozo</MenuItem>
                        </Select>
                        {touched.CARGO && errors.CARGO ? (
                          <FormHelperText>{errors.CARGO}</FormHelperText>
                        ) : null}
                      </FormControl>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 16,
                        marginBottom: 12,
                      }}
                    >
                      <FormControl
                        margin="dense"
                        variant="outlined"
                        className={classes.textField}
                        error={
                          touched.YA_USA_SISTEMA &&
                          Boolean(errors.YA_USA_SISTEMA)
                        }
                      >
                        <InputLabel id="YA_USA_SISTEMA-label">
                          Ya usa sistema
                        </InputLabel>
                        <Select
                          labelId="YA_USA_SISTEMA-label"
                          id="YA_USA_SISTEMA"
                          name="YA_USA_SISTEMA"
                          value={values.YA_USA_SISTEMA}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          label="YA USA SISTEMA"
                        >
                          <MenuItem value="SI">Si</MenuItem>
                          <MenuItem value="NO">No</MenuItem>
                        </Select>
                        {touched.YA_USA_SISTEMA && errors.YA_USA_SISTEMA ? (
                          <FormHelperText>
                            {errors.YA_USA_SISTEMA}
                          </FormHelperText>
                        ) : null}
                      </FormControl>

                      <Autocomplete
                        value={values.SISTEMA_ACTUAL}
                        className={classes.textField}
                        options={allSISTEMA_ACTUALOptions}
                        clearOnBlur
                        autoHighlight
                        freeSolo
                        clearOnEscape
                        margin="dense"
                        getOptionLabel={(option) =>
                          option.replace(/Añadir: /, "")
                        }
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
                          const filtered = filter(options, params);
                          if (
                            !options.find((o) => o.includes(params.inputValue))
                          ) {
                            filtered.push(`Añadir: ${params.inputValue}`);
                          }
                          return filtered;
                        }}
                        onChange={(e, newValue) => {
                          setFieldValue("SISTEMA_ACTUAL", newValue || "");
                        }}
                        renderInput={(params) => (
                          <Field
                            as={TextField}
                            {...params}
                            label={"Sistema actual"}
                            autoFocus
                            name="SISTEMA_ACTUAL"
                            error={
                              touched.SISTEMA_ACTUAL &&
                              Boolean(errors.SISTEMA_ACTUAL)
                            }
                            helperText={
                              touched.SISTEMA_ACTUAL && errors.SISTEMA_ACTUAL
                            }
                            variant="outlined"
                            margin="dense"
                          />
                        )}
                      />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 16,
                        marginBottom: 12,
                      }}
                    >
                      <Field
                        as={TextField}
                        label={"Paga mensualmente (USD)"}
                        autoFocus
                        type="number"
                        name="CUANTO_PAGA"
                        error={
                          touched.CUANTO_PAGA && Boolean(errors.CUANTO_PAGA)
                        }
                        helperText={touched.CUANTO_PAGA && errors.CUANTO_PAGA}
                        variant="outlined"
                        margin="dense"
                      />

                      <Autocomplete
                        value={values.COMO_SE_ENTERO}
                        className={classes.textField}
                        options={allCOMO_SE_ENTEROOptions}
                        clearOnBlur
                        autoHighlight
                        freeSolo
                        clearOnEscape
                        margin="dense"
                        getOptionLabel={(option) =>
                          option.replace(/Añadir: /, "")
                        }
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
                          const filtered = filter(options, params);
                          if (
                            !options.find((o) => o.includes(params.inputValue))
                          ) {
                            filtered.push(`Añadir: ${params.inputValue}`);
                          }
                          return filtered;
                        }}
                        onChange={(e, newValue) => {
                          setFieldValue("COMO_SE_ENTERO", newValue || "");
                        }}
                        renderInput={(params) => (
                          <Field
                            as={TextField}
                            {...params}
                            label={"Como se enteró"}
                            autoFocus
                            name="COMO_SE_ENTERO"
                            error={
                              touched.COMO_SE_ENTERO &&
                              Boolean(errors.COMO_SE_ENTERO)
                            }
                            helperText={
                              touched.COMO_SE_ENTERO && errors.COMO_SE_ENTERO
                            }
                            variant="outlined"
                            margin="dense"
                          />
                        )}
                      />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 16,
                        marginBottom: 12,
                      }}
                    >
                      <Field
                        as={TextField}
                        label={"Num. de sucursales"}
                        type="number"
                        autoFocus
                        name="NUM_SUCURSALES"
                        error={
                          touched.NUM_SUCURSALES &&
                          Boolean(errors.NUM_SUCURSALES)
                        }
                        helperText={
                          touched.NUM_SUCURSALES && errors.NUM_SUCURSALES
                        }
                        variant="outlined"
                        margin="dense"
                      />

                      <Field
                        as={TextField}
                        label={"Num. de mesas"}
                        type="number"
                        autoFocus
                        name="NUM_MESAS"
                        error={touched.NUM_MESAS && Boolean(errors.NUM_MESAS)}
                        helperText={touched.NUM_MESAS && errors.NUM_MESAS}
                        variant="outlined"
                        margin="dense"
                      />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 16,
                        marginBottom: 12,
                      }}
                    >
                      <Autocomplete
                        value={values.DOLOR_1}
                        className={classes.textField}
                        options={allDOLOROptions}
                        clearOnBlur
                        autoHighlight
                        freeSolo
                        clearOnEscape
                        margin="dense"
                        getOptionLabel={(option) =>
                          option.replace(/Añadir: /, "")
                        }
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
                          const filtered = filter(options, params);
                          if (
                            !options.find((o) => o.includes(params.inputValue))
                          ) {
                            filtered.push(`Añadir: ${params.inputValue}`);
                          }
                          return filtered;
                        }}
                        onChange={(e, newValue) => {
                          setFieldValue("DOLOR_1", newValue || "");
                        }}
                        renderInput={(params) => (
                          <Field
                            as={TextField}
                            {...params}
                            label={"Punto de dolor 1"}
                            autoFocus
                            name="DOLOR_1"
                            error={touched.DOLOR_1 && Boolean(errors.DOLOR_1)}
                            helperText={touched.DOLOR_1 && errors.DOLOR_1}
                            variant="outlined"
                            margin="dense"
                            className={classes.textField}
                          />
                        )}
                      />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 16,
                        // marginBottom: 12,
                      }}
                    >
                      <Autocomplete
                        value={values.DOLOR_2}
                        className={classes.textField}
                        options={allDOLOROptions}
                        clearOnBlur
                        autoHighlight
                        freeSolo
                        clearOnEscape
                        margin="dense"
                        getOptionLabel={(option) =>
                          option.replace(/Añadir: /, "")
                        }
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
                          const filtered = filter(options, params);
                          if (
                            !options.find((o) => o.includes(params.inputValue))
                          ) {
                            filtered.push(`Añadir: ${params.inputValue}`);
                          }
                          return filtered;
                        }}
                        onChange={(e, newValue) => {
                          setFieldValue("DOLOR_2", newValue || "");
                        }}
                        renderInput={(params) => (
                          <Field
                            as={TextField}
                            {...params}
                            label={"Punto de dolor 2"}
                            autoFocus
                            name="DOLOR_2"
                            error={touched.DOLOR_2 && Boolean(errors.DOLOR_2)}
                            helperText={touched.DOLOR_2 && errors.DOLOR_2}
                            variant="outlined"
                            margin="dense"
                            className={classes.textField}
                          />
                        )}
                      />
                    </div>
                  </div>
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
                  color="primary"
                  disabled={isSubmitting}
                  variant="outlined"
                  className={classes.btnWrapper}
                  onClick={() => handleSendToZapier(values, true)}
                >
                  Guardar datos
                  {isSubmitting && (
                    <CircularProgress
                      size={24}
                      className={classes.buttonProgress}
                    />
                  )}
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  disabled={isSubmitting}
                  variant="contained"
                  className={classes.btnWrapper}
                >
                  Crear en Trazabilidad
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
