import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";

const useStyles = makeStyles(() => ({
  banner: {
    backgroundColor: "#fff8e1",
    borderBottom: "1px solid #ffcc02",
    padding: "4px 12px",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  text: {
    fontSize: "0.72rem",
    color: "#bf360c",
  },
}));

const WindowWarningBanner = () => {
  const classes = useStyles();

  return (
    <Box className={classes.banner}>
      <Typography className={classes.text}>
        Se recomienda enviar un solo mensaje hasta que el cliente responda y se abra la ventana de 24h, SOLO acepta texto
      </Typography>
    </Box>
  );
};

export default WindowWarningBanner;
