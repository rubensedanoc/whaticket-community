import Chip from "@material-ui/core/Chip";
import {
  differenceInHours,
  formatDistanceStrict,
  fromUnixTime,
} from "date-fns";
import { es } from "date-fns/locale";
import React, { useEffect, useState } from "react";

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

  return (
    <Chip
      style={{ height: "16px", fontSize: "9px" }}
      color={
        differenceInHours(nowTime, fromUnixTime(beenWaitingSinceTimestamp)) >=
        24
          ? "secondary"
          : "default"
      }
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
