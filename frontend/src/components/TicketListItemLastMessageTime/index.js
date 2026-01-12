import Chip from "@material-ui/core/Chip";
import {
  formatDistanceStrict,
  fromUnixTime,
} from "date-fns";
import { es } from "date-fns/locale";
import React, { useEffect, useState } from "react";

// Función para determinar el color según el tiempo de espera en minutos
const getColorByWaitingTime = (minutes) => {
  if (minutes < 30) {
    return "#4caf50"; // Verde - Todo bien (0-30 min)
  } else if (minutes < 60) {
    return "#ffeb3b"; // Amarillo - Atención (30-60 min)
  } else if (minutes < 120) {
    return "#ff9800"; // Naranja - Importante (1-2 horas)
  } else if (minutes < 240) {
    return "#ff5722"; // Naranja oscuro - Urgente (2-4 horas)
  } else if (minutes < 480) {
    return "#f44336"; // Rojo - Muy urgente (4-8 horas)
  } else if (minutes < 960) {
    return "#d32f2f"; // Rojo oscuro - Crítico (8-16 horas)
  } else {
    return "#757575"; // Gris - Atención especial (>16 horas)
  }
};

// Función para obtener el color del texto según el fondo
const getTextColorByBackground = (bgColor) => {
  // Colores oscuros necesitan texto blanco
  const darkColors = ["#d32f2f", "#f44336", "#ff5722", "#757575"];
  return darkColors.includes(bgColor) ? "#ffffff" : "#000000";
};

export default function TicketListItemLastMessageTime({
  beenWaitingSinceTimestamp,
}) {
  const [nowTime, setNowTime] = useState(new Date().getTime());

  useEffect(() => {
    let interval;

    // console.log("beenWaitingSinceTimestamp", beenWaitingSinceTimestamp);

    interval = setInterval(() => {
      setNowTime((old) => old + 5000);
    }, 5000);

    return () => clearInterval(interval);
  }, [beenWaitingSinceTimestamp]);

  // Calcular minutos de espera
  const timestamp = fromUnixTime(beenWaitingSinceTimestamp);
  const waitingMinutes = Math.floor(
    (nowTime - timestamp.getTime()) / (1000 * 60)
  );

  // Obtener colores según tiempo de espera
  const backgroundColor = getColorByWaitingTime(waitingMinutes);
  const textColor = getTextColorByBackground(backgroundColor);

  return (
    <Chip
      style={{
        height: "16px",
        fontSize: "9px",
        backgroundColor: backgroundColor,
        color: textColor,
        fontWeight: "bold",
      }}
      size="small"
      label={`${formatDistanceStrict(
        nowTime,
        fromUnixTime(beenWaitingSinceTimestamp),
        {
          locale: es,
        }
      )}`}
    />
  );
}
