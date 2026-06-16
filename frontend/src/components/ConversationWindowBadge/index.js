import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Chip from "@material-ui/core/Chip";

const useStyles = makeStyles(() => ({
  badgeActive: {
    backgroundColor: "#4caf50",
    color: "white",
    fontWeight: 500,
  },
  badgeExpiring: {
    backgroundColor: "#ff9800",
    color: "white",
    fontWeight: 500,
  },
  badgeClosed: {
    backgroundColor: "#f44336",
    color: "white",
    fontWeight: 500,
  },
  badgeGroup: {
    backgroundColor: "#2196f3",
    color: "white",
    fontWeight: 500,
  },
  badgeLoading: {
    backgroundColor: "#9e9e9e",
    color: "white",
    fontWeight: 500,
  },
}));

const formatTime = (hours) => {
  if (hours == null || isNaN(hours)) return "";
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const ConversationWindowBadge = ({ conversationWindow, isGroup }) => {
  const classes = useStyles();

  if (isGroup) {
    return (
      <Chip
        size="small"
        label="Grupo — Sin restricción"
        className={classes.badgeGroup}
      />
    );
  }

  if (!conversationWindow) {
    return (
      <Chip
        size="small"
        label="···"
        className={classes.badgeLoading}
      />
    );
  }

  const { isOpen, type, hoursRemaining, lastIncomingAt } = conversationWindow;

  if (isOpen && type === "active") {
    const remaining = hoursRemaining ?? 0;
    if (remaining < 2) {
      return (
        <Chip
          size="small"
          label={`Ventana por cerrar · Quedan ${formatTime(remaining)}`}
          className={classes.badgeExpiring}
        />
      );
    }
    return (
      <Chip
        size="small"
        label={`Ventana activa · Quedan ${formatTime(remaining)}`}
        className={classes.badgeActive}
      />
    );
  }

  if (type === "new_contact") {
    return (
      <Chip
        size="small"
        label="Sin historial — Se usará plantilla"
        className={classes.badgeClosed}
      />
    );
  }

  if (type === "expired") {
    const hoursAgo = lastIncomingAt
      ? formatTime((Date.now() - new Date(lastIncomingAt).getTime()) / 3600000)
      : "";
    return (
      <Chip
        size="small"
        label={`Ventana cerrada${hoursAgo ? ` · Último msg: hace ${hoursAgo}` : ""}`}
        className={classes.badgeClosed}
      />
    );
  }

  return (
    <Chip
      size="small"
      label="···"
      className={classes.badgeLoading}
    />
  );
};

export default ConversationWindowBadge;
