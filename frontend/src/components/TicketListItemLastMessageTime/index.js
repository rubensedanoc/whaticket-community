import Chip from "@material-ui/core/Chip";
import {
  differenceInHours,
  formatDistanceStrict,
  fromUnixTime,
} from "date-fns";
import { es } from "date-fns/locale";
import React, { useEffect, useState } from "react";

export default function TicketListItemLastMessageTime({ clientTimeWaiting }) {
  const [nowTime, setNowTime] = useState(new Date().getTime());

  useEffect(() => {
    let interval;

    // console.log("clientTimeWaiting", clientTimeWaiting);

    interval = setInterval(() => {
      setNowTime((old) => old + 5000);
    }, 5000);

    return () => clearInterval(interval);
  }, [clientTimeWaiting]);

  return (
    <Chip
      style={{ height: "20px", fontSize: "11px" }}
      color={
        differenceInHours(nowTime, fromUnixTime(clientTimeWaiting)) >= 24
          ? "secondary"
          : "default"
      }
      size="small"
      label={`Hace ${formatDistanceStrict(
        nowTime,
        fromUnixTime(clientTimeWaiting),
        {
          locale: es,
        }
      )}`}
    />
  );
}
