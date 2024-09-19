import React, { useEffect, useRef, useState } from "react";

import { Field, FieldArray, Form, Formik } from "formik";
import { toast } from "react-toastify";
import * as Yup from "yup";

import { ListItemText } from "@material-ui/core";
import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import IconButton from "@material-ui/core/IconButton";
import MenuItem from "@material-ui/core/MenuItem";

import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";
import { green } from "@material-ui/core/colors";
import { makeStyles } from "@material-ui/core/styles";

import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";

import { i18n } from "../../translate/i18n";

import toastError from "../../errors/toastError";
import api from "../../services/api";
import NewContactDomainModal from "../NewContactDomainModal";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },
  textField: {
    marginRight: theme.spacing(1),
    flex: 1,
  },

  extraAttr: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
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
}));

const ContactSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, "Too Short!")
    .max(50, "Too Long!")
    .required("Required"),
  number: Yup.string().min(8, "Too Short!").max(50, "Too Long!"),
  email: Yup.string().email("Invalid email"),
});

const ContactModal = ({ open, onClose, contactId, initialValues, onSave }) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  const initialState = {
    name: "",
    number: "",
    email: "",
    domain: "",
  };

  const [contact, setContact] = useState(initialState);
  const [countries, setCountries] = useState([]);
  const [chooseCountryId, setChooseCountryId] = useState(null);
  const [newContactDomainModal, setNewContactDomainModal] = useState(false);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    const fetchContact = async () => {
      if (initialValues) {
        setContact((prevState) => {
          return { ...prevState, ...initialValues };
        });
      }

      if (open) {
        try {
          const { data } = await api.get(`/countries`);
          if (data?.countries?.length > 0) {
            setCountries(data.countries);
          }
        } catch (err) {
          toastError(err);
        }
      }

      if (!contactId) return;

      try {
        const { data } = await api.get(`/contacts/${contactId}`);
        if (isMounted.current) {
          setContact(data);
          if (data?.countryId) {
            setChooseCountryId(data.countryId);
          }
        }
      } catch (err) {
        toastError(err);
      }
    };

    fetchContact();
  }, [contactId, open, initialValues]);

  const handleClose = () => {
    onClose();
    setContact(initialState);
  };

  const handleSaveContact = async (values) => {
    try {
      if (!chooseCountryId) {
        toast.error("El país es obligatorio");
        return;
      }

      if (contactId) {
        await api.put(`/contacts/${contactId}`, {
          ...values,
          countryId: chooseCountryId,
        });
        handleClose();
      } else {
        const { data } = await api.post("/contacts", {
          ...values,
          countryId: chooseCountryId,
        });
        if (onSave) {
          onSave(data);
        }
        handleClose();
      }
      toast.success(i18n.t("contactModal.success"));
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <div className={classes.root}>
      <Dialog open={open} onClose={handleClose} maxWidth="lg" scroll="paper">
        <DialogTitle id="form-dialog-title">
          {contactId
            ? `${i18n.t("contactModal.title.edit")}`
            : `${i18n.t("contactModal.title.add")}`}
        </DialogTitle>
        <Formik
          initialValues={{
            ...contact,
            ...(!contact.domain && { domain: "" }),
          }}
          enableReinitialize={true}
          validationSchema={ContactSchema}
          onSubmit={(values, actions) => {
            setTimeout(async () => {
              await handleSaveContact(values);
              actions.setSubmitting(false);
            }, 400);
          }}
        >
          {({ values, errors, touched, isSubmitting }) => (
            <Form>
              <DialogContent dividers>
                <Typography variant="subtitle1" gutterBottom>
                  {i18n.t("contactModal.form.mainInfo")}
                </Typography>
                <Field
                  as={TextField}
                  label={i18n.t("contactModal.form.name")}
                  name="name"
                  autoFocus
                  error={touched.name && Boolean(errors.name)}
                  helperText={touched.name && errors.name}
                  variant="outlined"
                  margin="dense"
                  className={classes.textField}
                />
                <Field
                  as={TextField}
                  label={i18n.t("contactModal.form.number")}
                  name="number"
                  error={touched.number && Boolean(errors.number)}
                  helperText={touched.number && errors.number}
                  placeholder="5513912344321"
                  variant="outlined"
                  margin="dense"
                />
                <div className={classes.extraAttr}>
                  <Field
                    as={TextField}
                    label={i18n.t("contactModal.form.email")}
                    name="email"
                    error={touched.email && Boolean(errors.email)}
                    helperText={touched.email && errors.email}
                    placeholder="Email address"
                    fullWidth
                    margin="dense"
                    variant="outlined"
                  />
                </div>
                <div className={classes.extraAttr}>
                  <Field
                    as={TextField}
                    name="countryId"
                    select
                    label="País"
                    fullWidth
                    margin="dense"
                    value={chooseCountryId}
                    onChange={(event) => {
                      setChooseCountryId(event.target.value);
                    }}
                    variant="outlined"
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
                    renderValue={(value) => {
                      if (value) {
                        return countries.find((c) => c.id === value)?.name;
                      }
                    }}
                  >
                    {countries?.length > 0 &&
                      countries.map((c) => (
                        <MenuItem dense key={c.id} value={c.id}>
                          <ListItemText primary={c.name} />
                        </MenuItem>
                      ))}
                  </Field>
                </div>
                {contactId && (
                  <>
                    <div className={classes.extraAttr}>
                      <Button
                        style={{ flex: 1, marginTop: 8 }}
                        variant="outlined"
                        color="primary"
                        onClick={() => {
                          setNewContactDomainModal(true);
                        }}
                      >
                        Relacionar con un dominio
                      </Button>
                      <NewContactDomainModal
                        modalOpen={newContactDomainModal}
                        onClose={() => setNewContactDomainModal(false)}
                        contact={contact}
                      />
                    </div>
                  </>
                )}

                {/* <Field
                    as={TextField}
                    label={"Dominio"}
                    name="domain"
                    placeholder="Dominio relacionado al contacto"
                    fullWidth
                    margin="dense"
                    variant="outlined"
                  /> */}
                <Typography
                  style={{ marginBottom: 8, marginTop: 12 }}
                  variant="subtitle1"
                >
                  {i18n.t("contactModal.form.extraInfo")}
                </Typography>

                <FieldArray name="extraInfo">
                  {({ push, remove }) => (
                    <>
                      {values.extraInfo &&
                        values.extraInfo.length > 0 &&
                        values.extraInfo.map((info, index) => (
                          <div
                            className={classes.extraAttr}
                            key={`${index}-info`}
                          >
                            <Field
                              as={TextField}
                              label={i18n.t("contactModal.form.extraName")}
                              name={`extraInfo[${index}].name`}
                              variant="outlined"
                              margin="dense"
                              className={classes.textField}
                            />
                            <Field
                              as={TextField}
                              label={i18n.t("contactModal.form.extraValue")}
                              name={`extraInfo[${index}].value`}
                              variant="outlined"
                              margin="dense"
                              className={classes.textField}
                            />
                            <IconButton
                              size="small"
                              onClick={() => remove(index)}
                            >
                              <DeleteOutlineIcon />
                            </IconButton>
                          </div>
                        ))}
                      <div className={classes.extraAttr}>
                        <Button
                          style={{ flex: 1, marginTop: 8 }}
                          variant="outlined"
                          color="primary"
                          onClick={() => push({ name: "", value: "" })}
                        >
                          {`+ ${i18n.t("contactModal.buttons.addExtraInfo")}`}
                        </Button>
                      </div>
                    </>
                  )}
                </FieldArray>
              </DialogContent>
              <DialogActions>
                <Button
                  onClick={handleClose}
                  color="secondary"
                  disabled={isSubmitting}
                  variant="outlined"
                >
                  {i18n.t("contactModal.buttons.cancel")}
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  disabled={isSubmitting}
                  variant="contained"
                  className={classes.btnWrapper}
                >
                  {contactId
                    ? `${i18n.t("contactModal.buttons.okEdit")}`
                    : `${i18n.t("contactModal.buttons.okAdd")}`}
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

export default ContactModal;
