import React, { useEffect, useState } from "react";

import { Field, Form, Formik } from "formik";
import { toast } from "react-toastify";
import * as Yup from "yup";

import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import TextField from "@material-ui/core/TextField";
import { green } from "@material-ui/core/colors";
import { makeStyles } from "@material-ui/core/styles";

import { i18n } from "../../translate/i18n";

import toastError from "../../errors/toastError";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },
  textField: {
    marginRight: theme.spacing(1),
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
  name: Yup.string()
    .min(2, "Too Short!")
    .max(50, "Too Long!")
    .required("Required"),
  color: Yup.string().min(3, "Too Short!").max(9, "Too Long!").required(),
});

const MarketingCampaignModal = ({ open, onClose, marketingCampaignId }) => {
  const classes = useStyles();

  const initialState = {
    name: "",
  };

  const [marketingCampaign, setMarketingCampaign] = useState(initialState);

  useEffect(() => {
    (async () => {
      if (!marketingCampaignId) return;
      try {
        const { data } = await api.get(
          `/getTicketDataToSendToZapier/${marketingCampaignId}`
        );
        setMarketingCampaign((prevState) => {
          return { ...prevState, ...data };
        });
      } catch (err) {
        toastError(err);
      }
    })();
    return () => {
      setMarketingCampaign({
        name: "",
      });
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

  return (
    <div className={classes.root}>
      <Dialog open={open} onClose={handleClose} scroll="paper">
        <DialogTitle>
          {marketingCampaignId ? `Editar campaña` : `Crear campaña`}
        </DialogTitle>
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
          {({ touched, errors, isSubmitting }) => (
            <Form>
              <DialogContent dividers>
                <Field
                  as={TextField}
                  label={"Nombre"}
                  autoFocus
                  name="name"
                  error={touched.name && Boolean(errors.name)}
                  helperText={touched.name && errors.name}
                  variant="outlined"
                  margin="dense"
                  className={classes.textField}
                />
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
      </Dialog>
    </div>
  );
};

export default MarketingCampaignModal;
