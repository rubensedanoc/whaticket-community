import { Router } from "express";
import isAuth from "../middleware/isAuth";

import * as ReportsController from "../controllers/ReportsController";

const reportsRoutes = Router();

reportsRoutes.get("/generalReport", isAuth, ReportsController.generalReport);
reportsRoutes.get("/generalReportv2", ReportsController.generalReportv2);
reportsRoutes.get("/reportHistory", ReportsController.reportHistory);
reportsRoutes.get(
  "/reportHistoryWithDateRange",
  ReportsController.reportHistoryWithDateRange
);

reportsRoutes.get(
  "/getOpenOrPendingTicketsWithLastMessages",
  isAuth,
  ReportsController.getOpenOrPendingTicketsWithLastMessages
);

reportsRoutes.get(
  "/getATicketsList",
  isAuth,
  ReportsController.getATicketsList
);

export default reportsRoutes;
