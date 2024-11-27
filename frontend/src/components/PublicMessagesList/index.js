import React, { useRef } from "react";

import clsx from "clsx";
import { format, fromUnixTime, isSameDay, parseISO } from "date-fns";

import { Button, Divider, IconButton, makeStyles } from "@material-ui/core";
import { green } from "@material-ui/core/colors";
import {
  AccessTime,
  Block,
  Done,
  DoneAll,
  Edit,
  ExpandMore,
  GetApp,
} from "@material-ui/icons";

import TextsmsOutlinedIcon from "@material-ui/icons/TextsmsOutlined";
import whatsBackground from "../../assets/wa-background.png";
import LocationPreview from "../LocationPreview";
import MarkdownWrapper from "../MarkdownWrapper";
import ModalImageCors from "../ModalImageCors";
import VcardPreview from "../VcardPreview";

import Audio from "../Audio";

const useStyles = makeStyles((theme) => ({
  messagesListWrapper: {
    overflow: "hidden",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
  },

  messagesList: {
    height: "100vh",
    backgroundImage: `url(${whatsBackground})`,
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    padding: "20px 20px 20px 20px",
    overflowY: "scroll",
    [theme.breakpoints.down("sm")]: {
      paddingBottom: "90px",
    },
    ...theme.scrollbarStyles,
  },

  circleLoading: {
    color: green[500],
    position: "absolute",
    opacity: "70%",
    top: 0,
    left: "50%",
    marginTop: 12,
  },

  messageLeft: {
    marginRight: 20,
    marginTop: 2,
    minWidth: 100,
    maxWidth: 600,
    height: "auto",
    display: "block",
    position: "relative",
    "&:hover #messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0,
    },

    whiteSpace: "pre-wrap",
    backgroundColor: "#ffffff",
    color: "#303030",
    alignSelf: "flex-start",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 5,
    paddingBottom: 0,
    boxShadow: "0 1px 1px #b3b3b3",
  },

  quotedContainerLeft: {
    margin: "-3px -80px 6px -6px",
    overflow: "hidden",
    backgroundColor: "#f0f0f0",
    borderRadius: "7.5px",
    display: "flex",
    position: "relative",
  },

  quotedContainerLeftFromOtherConnection: {
    margin: "-3px -80px 6px -6px",
    overflow: "hidden",
    backgroundColor: "#daeced",
    borderRadius: "7.5px",
    display: "flex",
    position: "relative",
  },

  quotedMsg: {
    padding: 10,
    maxWidth: 300,
    height: "auto",
    display: "block",
    whiteSpace: "pre-wrap",
    overflow: "hidden",
  },

  quotedSideColorLeft: {
    flex: "none",
    width: "4px",
    backgroundColor: "#6bcbef",
  },

  messageRight: {
    marginLeft: 20,
    marginTop: 2,
    minWidth: 100,
    maxWidth: 600,
    height: "auto",
    display: "block",
    position: "relative",
    "&:hover #messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0,
    },

    whiteSpace: "pre-wrap",
    backgroundColor: "#dcf8c6",
    color: "#303030",
    alignSelf: "flex-end",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 0,
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 5,
    paddingBottom: 0,
    boxShadow: "0 1px 1px #b3b3b3",
  },

  messageLeftFromOtherConnection: {
    marginRight: 20,
    marginTop: 2,
    minWidth: 100,
    maxWidth: 600,
    height: "auto",
    display: "block",
    position: "relative",
    "&:hover #messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0,
    },

    whiteSpace: "pre-wrap",
    backgroundColor: "#ebfeff",
    color: "#303030",
    alignSelf: "flex-start",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 5,
    paddingBottom: 0,
    boxShadow: "0 1px 1px #b3b3b3",
  },

  privateMessageRight: {
    marginLeft: 20,
    marginTop: 2,
    minWidth: 100,
    maxWidth: 600,
    height: "auto",
    display: "block",
    position: "relative",
    "&:hover #messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0,
    },

    whiteSpace: "pre-wrap",
    backgroundColor: "#FFFFD4",
    color: "#303030",
    alignSelf: "flex-end",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 0,
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 5,
    paddingBottom: 0,
    boxShadow: "0 1px 1px #b3b3b3",
  },

  quotedContainerRight: {
    margin: "-3px -80px 6px -6px",
    overflowY: "hidden",
    backgroundColor: "#cfe9ba",
    borderRadius: "7.5px",
    display: "flex",
    position: "relative",
  },

  quotedMsgRight: {
    padding: 10,
    maxWidth: 300,
    height: "auto",
    whiteSpace: "pre-wrap",
  },

  quotedSideColorRight: {
    flex: "none",
    width: "4px",
    backgroundColor: "#35cd96",
  },

  messageActionsButton: {
    display: "none",
    position: "relative",
    color: "#999",
    zIndex: 1,
    backgroundColor: "inherit",
    opacity: "90%",
    "&:hover, &.Mui-focusVisible": { backgroundColor: "inherit" },
  },

  messageContactName: {
    display: "flex",
    alignItems: "center",
    color: "#6bcbef",
    fontWeight: 500,
  },

  textContentItem: {
    overflowWrap: "break-word",
    padding: "3px 80px 6px 6px",
  },

  textContentItemDeleted: {
    fontStyle: "italic",
    color: "rgba(0, 0, 0, 0.36)",
    overflowWrap: "break-word",
    padding: "3px 80px 6px 6px",
  },

  messageMedia: {
    objectFit: "cover",
    width: 250,
    height: 200,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },

  timestamp: {
    fontSize: 11,
    position: "absolute",
    bottom: 0,
    right: 5,
    color: "#999",
  },

  dailyTimestamp: {
    alignItems: "center",
    textAlign: "center",
    alignSelf: "center",
    width: "110px",
    backgroundColor: "#e1f3fb",
    margin: "10px",
    borderRadius: "10px",
    boxShadow: "0 1px 1px #b3b3b3",
  },

  ticketDivider: {
    alignItems: "center",
    textAlign: "center",
    alignSelf: "center",
    width: "100%",
    backgroundColor: "#303030",
    fontSize: 18,
    color: "white",
    margin: "16px 0px 16px",
    paddingTop: "5px",
    paddingBottom: "5px",
    borderRadius: "10px",
    boxShadow: "0 1px 1px #b3b3b3",
  },

  dailyTimestampText: {
    color: "#808888",
    padding: 8,
    alignSelf: "center",
    marginLeft: "0px",
  },

  ackIcons: {
    fontSize: 18,
    verticalAlign: "middle",
    marginLeft: 4,
  },

  deletedIcon: {
    fontSize: 18,
    verticalAlign: "middle",
    marginRight: 4,
  },

  ackDoneAllIcon: {
    color: green[500],
    fontSize: 18,
    verticalAlign: "middle",
    marginLeft: 4,
  },

  downloadMedia: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "inherit",
    padding: 10,
  },
}));

const PublicMessagesList = ({ messagesList, whatsApps, isGroup }) => {
  const classes = useStyles();

  const lastMessageRef = useRef();

  const checkMessageMedia = (message) => {
    if (
      message.mediaType === "location" &&
      message.body.split("|").length >= 2
    ) {
      let locationParts = message.body.split("|");
      let imageLocation = locationParts[0];
      let linkLocation = locationParts[1];

      let descriptionLocation = null;

      if (locationParts.length > 2)
        descriptionLocation = message.body.split("|")[2];

      return (
        <LocationPreview
          image={imageLocation}
          link={linkLocation}
          description={descriptionLocation}
        />
      );
    } else if (message.mediaType === "vcard") {
      //console.log("vcard")
      //console.log(message)
      let array = message.body.split("\n");
      let obj = [];
      let contact = "";
      for (let index = 0; index < array.length; index++) {
        const v = array[index];
        let values = v.split(":");
        for (let ind = 0; ind < values.length; ind++) {
          if (values[ind].indexOf("+") !== -1) {
            obj.push({ number: values[ind] });
          }
          if (values[ind].indexOf("FN") !== -1) {
            contact = values[ind + 1];
          }
        }
      }
      return <VcardPreview contact={contact} numbers={obj[0]?.number} />;
    } else if (
      /*else if (message.mediaType === "multi_vcard") {
      console.log("multi_vcard")
      console.log(message)
    	
      if(message.body !== null && message.body !== "") {
        let newBody = JSON.parse(message.body)
        return (
          <>
            {
            newBody.map(v => (
              <VcardPreview contact={v.name} numbers={v.number} />
            ))
            }
          </>
        )
      } else return (<></>)
    }*/
      /^.*\.(jpe?g|png|gif)?$/i.exec(message.mediaUrl) &&
      message.mediaType === "image"
    ) {
      return <ModalImageCors imageUrl={message.mediaUrl} />;
    } else if (message.mediaType === "audio") {
      return <Audio url={message.mediaUrl} />;
    } else if (message.mediaType === "video") {
      return (
        <video
          className={classes.messageMedia}
          src={message.mediaUrl}
          controls
          style={{
            objectFit: "contain", // Asegura que se vea todo el contenido
            width: "100%", // Ajusta el ancho a su contenedor
            maxHeight: "100vh", // Limita la altura al 100% de la ventana
          }}
        />
      );
    } else {
      return (
        <>
          <div className={classes.downloadMedia}>
            <Button
              startIcon={<GetApp />}
              color="primary"
              variant="outlined"
              target="_blank"
              href={message.mediaUrl}
            >
              Download
            </Button>
          </div>
          <Divider />
        </>
      );
    }
  };

  const renderMessageAck = (message) => {
    if (message.ack === 0) {
      return <AccessTime fontSize="small" className={classes.ackIcons} />;
    }
    if (message.ack === 1) {
      return <Done fontSize="small" className={classes.ackIcons} />;
    }
    if (message.ack === 2) {
      return <DoneAll fontSize="small" className={classes.ackIcons} />;
    }
    if (message.ack === 3 || message.ack === 4) {
      return <DoneAll fontSize="small" className={classes.ackDoneAllIcon} />;
    }
  };

  const renderTicketDividers = (message, index) => {
    if (index === 0) {
      return (
        <div
          className={classes.ticketDivider}
          key={`timestamp-${message.ticketId}`}
        >
          <div>Ticket: {message.ticketId}</div>
          {message.ticket?.chatbotMessageIdentifier && (
            <div style={{ fontSize: "14px" }}>*Mensaje automatico*</div>
          )}
        </div>
      );
    }

    if (index > 0 && index <= messagesList.length - 1) {
      let previousMessage = messagesList[index - 1];
      if (message?.ticketId !== previousMessage?.ticketId) {
        return (
          <div
            className={classes.ticketDivider}
            key={`timestamp-${message.ticketId}`}
          >
            <div>Ticket: {message.ticketId}</div>
            {message.ticket?.chatbotMessageIdentifier && (
              <div style={{ fontSize: "14px" }}>*Mensaje automatico*</div>
            )}
          </div>
        );
      }
    }
  };

  const renderDailyTimestamps = (message, index) => {
    if (index === 0) {
      return (
        <span
          className={classes.dailyTimestamp}
          key={`timestamp-${message.id}`}
        >
          <div className={classes.dailyTimestampText}>
            {format(
              messagesList[index].timestamp
                ? fromUnixTime(messagesList[index].timestamp)
                : parseISO(messagesList[index].createdAt),
              "dd/MM/yyyy"
            )}
          </div>
        </span>
      );
    }
    if (index <= messagesList.length - 1) {
      let messageDay = messagesList[index].timestamp
        ? fromUnixTime(messagesList[index].timestamp)
        : parseISO(messagesList[index].createdAt);

      let previousMessageDay = messagesList[index - 1].timestamp
        ? fromUnixTime(messagesList[index - 1].timestamp)
        : parseISO(messagesList[index - 1].createdAt);

      if (!isSameDay(messageDay, previousMessageDay)) {
        return (
          <span
            className={classes.dailyTimestamp}
            key={`timestamp-${message.id}`}
          >
            <div className={classes.dailyTimestampText}>
              {format(
                messagesList[index].timestamp
                  ? fromUnixTime(messagesList[index].timestamp)
                  : parseISO(messagesList[index].createdAt),
                "dd/MM/yyyy"
              )}
            </div>
          </span>
        );
      }
    }
  };

  const renderMessageDivider = (message, index) => {
    if (index < messagesList.length && index > 0) {
      let messageUser = messagesList[index].fromMe;
      let previousMessageUser = messagesList[index - 1].fromMe;

      if (messageUser !== previousMessageUser) {
        return (
          <span style={{ marginTop: 16 }} key={`divider-${message.id}`}></span>
        );
      }
    }
  };

  const renderQuotedMessage = (message) => {
    return (
      <div
        style={{ cursor: "pointer" }}
        onClick={(e) => {
          e.stopPropagation();
          console.log("Quoted message clicked:", message);
        }}
        className={clsx(classes.quotedContainerLeft, {
          [classes.quotedContainerRight]:
            message.fromMe ||
            (isGroup &&
              !message.fromMe &&
              (whatsApps.find((w) => w.number === message.contact?.number) ||
                message.contact?.isCompanyMember)),
        })}
      >
        <span
          className={clsx(classes.quotedSideColorLeft, {
            [classes.quotedSideColorRight]: message.quotedMsg?.fromMe,
          })}
        ></span>
        <div className={classes.quotedMsg}>
          <span className={classes.messageContactName}>
            {message.quotedMsg?.fromMe ? (
              <>Tú</>
            ) : (
              <>
                {message.quotedMsg?.contact?.name}
                <div style={{ fontSize: 11, color: "#999", marginRight: 30 }}>
                  {" "}
                  +{message.quotedMsg?.contact?.number}
                </div>
              </>
            )}
          </span>
          {message.quotedMsg?.body}
        </div>
      </div>
    );
  };

  const renderLastMessageMark = (message, index) => {
    return (
      <>
        {index === messagesList.length - 1 && (
          <div
            key={`ref-${message.timestamp || message.createdAt}`}
            ref={lastMessageRef}
            style={{ float: "left", clear: "both" }}
          />
        )}
      </>
    );
  };

  const renderMessages = () => {
    if (messagesList.length > 0) {
      const viewMessagesList = messagesList.map((message, index) => {
        if (!message.fromMe) {
          return (
            <React.Fragment key={message.id}>
              {renderMessageDivider(message, index)}
              {renderTicketDividers(message, index)}
              {renderDailyTimestamps(message, index)}
              {renderLastMessageMark(message, index)}
              <div
                className={
                  isGroup &&
                  (whatsApps.find(
                    (w) => w.number === message.contact?.number
                  ) ||
                    message.contact?.isCompanyMember)
                    ? classes.messageRight
                    : classes.messageLeft
                }
              >
                <IconButton
                  variant="contained"
                  size="small"
                  id="messageActionsButton"
                  disabled={message.isDeleted}
                  className={classes.messageActionsButton}
                >
                  <ExpandMore />
                </IconButton>
                {isGroup && (
                  <div className={classes.messageContactName}>
                    {message.contact?.name}{" "}
                    <div
                      style={{ fontSize: 11, color: "#999", marginRight: 30 }}
                    >
                      {" "}
                      +{message.contact?.number}
                    </div>
                  </div>
                )}
                {(message.mediaUrl ||
                  message.mediaType === "location" ||
                  message.mediaType === "vcard") &&
                  //|| message.mediaType === "multi_vcard"
                  checkMessageMedia(message)}
                <div className={classes.textContentItem}>
                  {message.quotedMsg && renderQuotedMessage(message)}
                  <MarkdownWrapper checkForWppNumbers={true}>
                    {message.body}
                  </MarkdownWrapper>
                  <span className={classes.timestamp}>
                    {format(
                      messagesList[index].timestamp
                        ? fromUnixTime(messagesList[index].timestamp)
                        : parseISO(messagesList[index].createdAt),
                      "HH:mm"
                    )}
                  </span>
                </div>
              </div>
            </React.Fragment>
          );
        } else {
          return (
            <React.Fragment key={message.id}>
              {renderMessageDivider(message, index)}
              {renderTicketDividers(message, index)}
              {renderDailyTimestamps(message, index)}
              {renderLastMessageMark(message, index)}
              <div
                className={
                  message.isPrivate
                    ? classes.privateMessageRight
                    : classes.messageRight
                }
              >
                <IconButton
                  variant="contained"
                  size="small"
                  id="messageActionsButton"
                  disabled={message.isDeleted}
                  className={classes.messageActionsButton}
                >
                  <ExpandMore />
                </IconButton>
                {(message.mediaUrl ||
                  message.mediaType === "location" ||
                  message.mediaType === "vcard") &&
                  //|| message.mediaType === "multi_vcard"
                  checkMessageMedia(message)}
                <div
                  className={clsx(classes.textContentItem, {
                    [classes.textContentItemDeleted]: message.isDeleted,
                  })}
                >
                  {message.isDeleted && (
                    <Block
                      color="disabled"
                      fontSize="small"
                      className={classes.deletedIcon}
                    />
                  )}
                  {message.isEdited && (
                    <Edit
                      color="disabled"
                      fontSize="small"
                      className={classes.deletedIcon}
                    />
                  )}
                  {message.quotedMsg && renderQuotedMessage(message)}
                  <MarkdownWrapper checkForWppNumbers={true}>
                    {message.body}
                  </MarkdownWrapper>
                  <span className={classes.timestamp}>
                    {format(
                      messagesList[index].timestamp
                        ? fromUnixTime(messagesList[index].timestamp)
                        : parseISO(messagesList[index].createdAt),
                      "HH:mm"
                    )}
                    {message.isPrivate ? (
                      <TextsmsOutlinedIcon
                        fontSize="small"
                        className={classes.ackIcons}
                      />
                    ) : (
                      renderMessageAck(message)
                    )}
                  </span>
                </div>
              </div>
            </React.Fragment>
          );
        }
      });
      return viewMessagesList;
    } else {
      return <div>Say hello to your new contact!</div>;
    }
  };

  return (
    <div className={classes.messagesListWrapper}>
      <div id="messagesList" className={classes.messagesList}>
        {messagesList.length > 0 && renderMessages()}
      </div>
      {/* {loading && (
        <div>
          <CircularProgress className={classes.circleLoading} />
        </div>
      )} */}
    </div>
  );
};

export default PublicMessagesList;
