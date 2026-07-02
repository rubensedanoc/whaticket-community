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
        ⚠️ Ventana cerrada — Los mensajes se enviarán como plantilla de WhatsApp. Puedes enviar varios mensajes, pero solo texto (no imágenes ni archivos). Una vez que el cliente responda, la ventana se abrirá automáticamente.
      </Typography>
    </Box>
  );
};

export default WindowWarningBanner;
