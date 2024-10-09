import React, { useEffect, useRef, useState } from "react";

import { Field, Form, Formik } from "formik";
import { toast } from "react-toastify";
import * as Yup from "yup";

import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Switch from "@material-ui/core/Switch";
import TextField from "@material-ui/core/TextField";
import { green } from "@material-ui/core/colors";
import { makeStyles } from "@material-ui/core/styles";
import UndoIcon from "@material-ui/icons/Undo";
import ConfirmationModal from "../../components/ConfirmationModal";

import { i18n } from "../../translate/i18n";

import Step from "@material-ui/core/Step";
import StepContent from "@material-ui/core/StepContent";
import StepLabel from "@material-ui/core/StepLabel";
import Stepper from "@material-ui/core/Stepper";

import CreateOutlinedIcon from "@material-ui/icons/CreateOutlined";
import DeleteOutlineOutlinedIcon from "@material-ui/icons/DeleteOutlineOutlined";
import SaveOutlinedIcon from "@material-ui/icons/SaveOutlined";
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

const QueueSchema = Yup.object().shape({
  identifier: Yup.string().min(2, "Too Short!").required("Required"),
  value: Yup.string().min(2, "Too Short!").required("Required"),
});

const ChatbotOptionList = ({
  fatherChatbotMessageId,
  chatbotOptionsFromProps,
}) => {
  const [chatbotOptions, setChatbotOptions] = useState([]);
  const [subChatbotOptions, setSubChatbotOptions] = useState([]);
  const [activeChatbotOptionIndex, setActiveChatbotOptionIndex] =
    useState(null);
  const [activeChatbotOption, setActiveChatbotOption] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmModalItemOpen, setConfirmModalItemOpen] = useState(null);

  useEffect(() => {
    if (chatbotOptionsFromProps) {
      setChatbotOptions(chatbotOptionsFromProps);
      console.log("chatbotOptionsFromProps", chatbotOptionsFromProps);
    }
  }, [chatbotOptionsFromProps]);

  useEffect(() => {
    if (!activeChatbotOption) {
      return;
    }

    (async () => {
      try {
        const { data } = await api.get(
          `/chatbotMessage/${activeChatbotOption.id}`
        );

        if (!data) {
          toastError("No se encontró la opción de chatbot");
          return;
        }

        setSubChatbotOptions((oldSubChatbotoptions) => [
          ...data.chatbotOptions,
          ...[
            {
              title: "Agregar Opción",
              value: "",
              isAddMoreOption: true,
              temporalId: Date.now(),
            },
          ],
        ]);
      } catch (err) {
        console.log("---- err", err);
        toastError(err);
      }
    })();
  }, [activeChatbotOption]);

  return (
    <>
      <ConfirmationModal
        title={
          confirmModalItemOpen &&
          `Estas seguro de borrar ${confirmModalItemOpen.title}??? primero avisa a un programador`
        }
        open={confirmModalOpen}
        onClose={() => {
          setConfirmModalOpen(false);
          setConfirmModalItemOpen(null);
        }}
        onConfirm={async () => {
          try {
            if (confirmModalItemOpen.id) {
              await api.delete(`/chatbotMessage/${confirmModalItemOpen.id}`);
              setChatbotOptions((oldChatbotOptions) => {
                const newChatbotOptions = [...oldChatbotOptions];

                const confirmModalItemOpenIndex = newChatbotOptions.findIndex(
                  (c) => c.id === confirmModalItemOpen.id
                );

                newChatbotOptions.splice(confirmModalItemOpenIndex, 1);
                return newChatbotOptions;
              });
              setActiveChatbotOptionIndex(false);
              setConfirmModalOpen(false);
              setConfirmModalItemOpen(null);
              toast.success("Opcion eliminada correctamente");
            }
          } catch (err) {
            toastError(err);
          }
        }}
      >
        Estas seguro de borrar esta opción?
      </ConfirmationModal>
      <Stepper
        activeStep={activeChatbotOptionIndex}
        nonLinear
        orientation="vertical"
      >
        {chatbotOptions.map((chatbotOption, chatbotOptionIndex) => (
          <Step
            key={chatbotOption.id || chatbotOption.temporalId}
            onClick={() => {
              if (chatbotOption.isTextField) {
                return;
              }

              // Add text field
              if (chatbotOption.isAddMoreOption) {
                const newTextFieldElement = {
                  isTextField: true,
                  temporalId: Date.now(),
                };

                setChatbotOptions((oldChatbotOptions) => {
                  const newChatbotOptions = [...oldChatbotOptions];

                  if (newChatbotOptions.length === 1) {
                    newChatbotOptions.unshift(newTextFieldElement);
                    return newChatbotOptions;
                  }

                  if (newChatbotOptions.length > 1) {
                    newChatbotOptions.splice(
                      newChatbotOptions.length - 1,
                      0,
                      newTextFieldElement
                    );
                    return newChatbotOptions;
                  }
                });

                return;
              }

              setActiveChatbotOptionIndex(chatbotOptionIndex);
              setActiveChatbotOption(chatbotOption);
            }}
          >
            <StepLabel style={{ cursor: "pointer" }}>
              {chatbotOption.isTextField ? (
                <>
                  <ChatbotOptionTextField
                    chatbotOptionIndex={chatbotOptionIndex}
                    fatherChatbotMessageId={fatherChatbotMessageId}
                    chatbotOption={chatbotOption}
                    onDelete={(temporalId) => {
                      if (chatbotOption.id) {
                        setChatbotOptions((oldChatbotOptions) => {
                          const newChatbotOptions = [...oldChatbotOptions];
                          newChatbotOptions.splice(chatbotOptionIndex, 1, {
                            ...chatbotOption,
                            isTextField: false,
                          });
                          return newChatbotOptions;
                        });
                      } else {
                        setChatbotOptions((oldChatbotOptions) => {
                          // console.log("oldChatbotOptions", [
                          //   ...oldChatbotOptions,
                          // ]);
                          // console.log(
                          //   "chatbotOption.temporalId",
                          //   chatbotOption
                          // );

                          const newChatbotOptions = oldChatbotOptions.filter(
                            (c) => c.temporalId !== temporalId
                          );
                          // console.log("newChatbotOptions", newChatbotOptions);

                          return newChatbotOptions;
                        });
                      }
                    }}
                    onSave={(newChatbotOption) => {
                      setChatbotOptions((oldChatbotOptions) => {
                        const newChatbotOptions = [...oldChatbotOptions];
                        newChatbotOptions.splice(
                          chatbotOptionIndex,
                          1,
                          newChatbotOption
                        );
                        return newChatbotOptions;
                      });
                    }}
                  />
                </>
              ) : (
                <div
                  style={{ display: "flex", gap: "6px", alignItems: "center" }}
                >
                  {chatbotOption.isAddMoreOption ? (
                    <div style={{ fontSize: "20px" }}>
                      {chatbotOption.title}
                    </div>
                  ) : (
                    <div style={{ fontSize: "20px" }}>
                      Identificador: {chatbotOption.label} || Opción:
                      {chatbotOption.title} || Orden: {chatbotOption.order}
                    </div>
                  )}

                  {!chatbotOption.isAddMoreOption && (
                    <div>
                      <CreateOutlinedIcon
                        onClick={() => {
                          setChatbotOptions((oldChatbotOptions) => {
                            const newChatbotOptions = [...oldChatbotOptions];

                            newChatbotOptions.splice(chatbotOptionIndex, 1, {
                              ...chatbotOption,
                              isTextField: true,
                            });

                            return newChatbotOptions;
                          });
                        }}
                      />
                      <DeleteOutlineOutlinedIcon
                        onClick={async () => {
                          setConfirmModalOpen(true);
                          setConfirmModalItemOpen(chatbotOption);
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </StepLabel>
            <StepContent>
              {!chatbotOption.isTextField && !chatbotOption.isAddMoreOption && (
                <>
                  <div>
                    <b>RESPUESTA:</b> {chatbotOption.value}
                  </div>
                  <br />
                  {chatbotOption.mediaType === "image" && (
                    <div>
                      <b>IMAGEN:</b> {chatbotOption.mediaUrl}
                    </div>
                  )}

                  <ChatbotOptionList
                    fatherChatbotMessageId={chatbotOption.id}
                    chatbotOptionsFromProps={subChatbotOptions}
                  />
                </>
              )}
            </StepContent>
          </Step>
        ))}
      </Stepper>
    </>
  );
};

const ChatbotOptionTextField = ({
  chatbotOptionIndex,
  chatbotOption,
  fatherChatbotMessageId,
  onDelete,
  onSave,
}) => {
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [withImage, setWithImage] = useState(false);
  const [mediaUrl, setMediaUrl] = useState("");
  const [label, setLabel] = useState(chatbotOptionIndex + 1);
  const [order, setOrder] = useState(chatbotOptionIndex + 1);

  useEffect(() => {
    if (chatbotOption.id) {
      setTitle(chatbotOption.title);
      setValue(chatbotOption.value);
      setLabel(chatbotOption.label);
      setOrder(chatbotOption.order);
      setWithImage(chatbotOption.mediaType === "image");
      setMediaUrl(chatbotOption.mediaUrl);
    }
  }, [chatbotOption]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flexGrow: "1",
          gap: "0.5rem",
        }}
      >
        <div style={{ display: "flex" }}>
          <TextField
            label="Orden"
            required
            value={order}
            variant="outlined"
            onChange={(e) => {
              setOrder(e.target.value);
            }}
          />
          <TextField
            label="Label"
            required
            value={label}
            variant="outlined"
            onChange={(e) => {
              setLabel(e.target.value);
            }}
          />
          <TextField
            style={{ marginLeft: "10px", flexGrow: "1" }}
            label="Nombre"
            required
            value={title}
            variant="outlined"
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <TextField
          label="Respuesta"
          required
          multiline
          variant="outlined"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "start",
          }}
        >
          <p>Con imagen</p>

          <Switch
            checked={withImage}
            onChange={(e) => setWithImage(e.target.checked)}
          />
        </div>
        {withImage && (
          <Field
            as={TextField}
            label="ImagenUrl"
            name="mediaUrl"
            variant="outlined"
            margin="dense"
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
          />
        )}
      </div>
      <SaveOutlinedIcon
        onClick={async () => {
          if (!title?.trim() || !value?.trim()) {
            toast.error("El nombre, la respuesta y el label son requeridos");
            return;
          }

          try {
            if (chatbotOption.id) {
              const updatedChatbotOption = await api.put(
                `/chatbotMessage/${chatbotOption.id}`,
                {
                  ...chatbotOption,
                  title,
                  value,
                  order,
                  mediaType: withImage ? "image" : "chat",
                  ...(withImage && { mediaUrl }),
                  ...(label && { label }),
                }
              );
              onSave(updatedChatbotOption.data);
            } else {
              const newChatbotOption = await api.post("/chatbotMessage", {
                title,
                value,
                fatherChatbotMessageId,
                order,
                mediaType: withImage ? "image" : "chat",
                ...(withImage && { mediaUrl }),
                ...(label && { label }),
              });

              onSave(newChatbotOption.data);
            }
            toast.success("Mensaje guardado correctamente");
          } catch (err) {
            toastError(err);
          }
        }}
      />
      <UndoIcon
        onClick={() => {
          onDelete(chatbotOption.temporalId);
        }}
      />
    </div>
  );
};

const ChatbotMessageModal = ({ open, onClose, chatbotMessageId }) => {
  const classes = useStyles();

  const initialState = {
    identifier: "",
    // title: "",
    value: "",
  };

  const [chatbotMessage, setChatbotMessage] = useState(initialState);
  const [options, setOptions] = useState([
    {
      title: "Agregar Opción",
      value: "",
      isAddMoreOption: true,
      temporalId: Date.now(),
    },
  ]);
  const [isActive, setIsActive] = useState(false);
  const [withImage, setWithImage] = useState(false);
  const [mediaUrl, setMediaUrl] = useState("");
  const greetingRef = useRef();

  // useEffect(() => {
  //   const fetchUsers = async () => {
  //     try {
  //       const { data } = await api.get("/users/", {});

  //       setUsers(data.users);
  //     } catch (err) {
  //       toastError(err);
  //     }
  //   };
  //   fetchUsers();
  // }, []);

  useEffect(() => {
    (async () => {
      if (!chatbotMessageId) {
        setOptions([
          {
            title: "Agregar Opción",
            value: "",
            isAddMoreOption: true,
            temporalId: Date.now(),
          },
        ]);
        return;
      }

      try {
        const { data } = await api.get(`/chatbotMessage/${chatbotMessageId}`);

        console.log("chatbotMessageId", data);

        setChatbotMessage((prevState) => {
          return { ...prevState, ...data };
        });

        setIsActive(data.isActive);
        setWithImage(data.mediaType === "image");
        setMediaUrl(data.mediaUrl);

        if (data.chatbotOptions && data.chatbotOptions.length > 0) {
          setOptions((oldChatbotOptions) => [
            ...data.chatbotOptions,
            {
              title: "Agregar Opción",
              value: "",
              isAddMoreOption: true,
              temporalId: Date.now(),
            },
          ]);
        } else {
          setOptions([
            {
              title: "Agregar Opción",
              value: "",
              isAddMoreOption: true,
              temporalId: Date.now(),
            },
          ]);
        }
      } catch (err) {
        toastError(err);
      }
    })();

    return () => {
      setChatbotMessage({
        identifier: "",
        isActive: false,
        withImage: false,
        mediaUrl: "",
        value: "",
      });
    };
  }, [chatbotMessageId, open]);

  const handleClose = () => {
    onClose();
    setChatbotMessage(initialState);
  };

  const handleSaveMessage = async (values) => {
    const MessageData = {
      ...values,
      isActive,
      mediaType: withImage ? "image" : "chat",
      ...(withImage && { mediaUrl }),
    };

    delete MessageData["chatbotOptions"];

    try {
      if (chatbotMessageId) {
        await api.put(`/chatbotMessage/${chatbotMessageId}`, MessageData);
      } else {
        await api.post("/chatbotMessage", {
          ...values,
          isActive,
          mediaType: withImage ? "image" : "chat",
          ...(withImage && { mediaUrl }),
        });
      }
      toast.success("Message saved successfully");
      handleClose();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <div className={classes.root}>
      <Dialog
        open={open}
        onClose={handleClose}
        fullWidth={true}
        maxWidth="md"
        scroll="paper"
      >
        <>
          <DialogTitle>
            {chatbotMessageId
              ? `Editar mensaje programado`
              : `Crear mensaje programado`}
          </DialogTitle>
          <Formik
            initialValues={chatbotMessage}
            enableReinitialize={true}
            validationSchema={QueueSchema}
            onSubmit={(values, actions) => {
              setTimeout(() => {
                handleSaveMessage(values);
                actions.setSubmitting(false);
              }, 400);
            }}
          >
            {({ touched, errors, isSubmitting, values }) => (
              <Form>
                <DialogContent dividers>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "start",
                    }}
                  >
                    <p>Activo</p>

                    <Switch
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                    />
                  </div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <Field
                      as={TextField}
                      label="Identificador"
                      name="identifier"
                      disabled={chatbotMessageId ? true : false}
                      error={touched.identifier && Boolean(errors.identifier)}
                      helperText={touched.identifier && errors.identifier}
                      variant="outlined"
                      margin="dense"
                      className={classes.textField}
                    />
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "start",
                      }}
                    >
                      <p>Con imagen</p>

                      <Switch
                        checked={withImage}
                        onChange={(e) => setWithImage(e.target.checked)}
                      />
                    </div>
                    {withImage && (
                      <Field
                        as={TextField}
                        label="ImagenUrl"
                        name="mediaUrl"
                        variant="outlined"
                        margin="dense"
                        className={classes.textField}
                        value={mediaUrl}
                        onChange={(e) => setMediaUrl(e.target.value)}
                      />
                    )}
                  </div>

                  <Field
                    as={TextField}
                    label="Mensaje"
                    multiline
                    minrows={5}
                    fullWidth
                    name="value"
                    error={touched.value && Boolean(errors.value)}
                    helperText={touched.value && errors.value}
                    variant="outlined"
                    margin="dense"
                    className={classes.textField}
                  />
                  {chatbotMessageId && (
                    <ChatbotOptionList
                      fatherChatbotMessageId={chatbotMessageId}
                      chatbotOptionsFromProps={options}
                    />
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
                    {chatbotMessageId
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
        </>
      </Dialog>
    </div>
  );
};

export default ChatbotMessageModal;
