import * as Sentry from "@sentry/node";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import "express-async-errors";
import "reflect-metadata";
import "./bootstrap";

import uploadConfig from "./config/upload";
import "./database";
import AppError from "./errors/AppError";
import { logCollectorMiddleware } from "./middleware/logCollectorMiddleware";
import routes from "./routes";
import { logger } from "./utils/logger";

Sentry.init({ dsn: process.env.SENTRY_DSN });

const app = express();

app.use(
  cors({
    origin: function (origin, callback) {
      // Permitir cualquier origen
      callback(null, origin || "*");
    },
    credentials: true
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(Sentry.Handlers.requestHandler());
app.use("/public", express.static(uploadConfig.directory));
app.use(logCollectorMiddleware);
app.use(routes);

app.use(Sentry.Handlers.errorHandler());

app.use(async (err: Error, req: Request, res: Response, _: NextFunction) => {
  if (err instanceof AppError) {
    logger.warn(err);
    return res
      .status(err.statusCode)
      .json({ error: err.message, logs: req.myLogData });
  }

  logger.error(err);
  return res
    .status(500)
    .json({ error: err, errorMessage: err?.message, logs: req.myLogData });
});

export default app;
