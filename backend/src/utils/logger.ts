import pino from "pino";

const logger = pino({
  prettyPrint: {
    ignore: "pid,hostname",
  },
  timestamp: pino.stdTimeFunctions.isoTime
});

export { logger };
