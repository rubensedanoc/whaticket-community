import { Router } from "express";
import isAuth from "../middleware/isAuth";

import * as ReportsController from "../controllers/ReportsController";

const reportsRoutes = Router();

reportsRoutes.get("/generalReport", isAuth, ReportsController.generalReport);

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

reportsRoutes.get("/reportHistory", ReportsController.reportHistory);
reportsRoutes.get(
  "/reportHistoryWithDateRange",
  ReportsController.reportHistoryWithDateRange
);
reportsRoutes.get("/reportToExcel", ReportsController.reportToExcel);
reportsRoutes.get("/reportToExcelForIA", ReportsController.reportToExcelForIA);
reportsRoutes.get("/reportToUsers", ReportsController.reportToUsers);
export default reportsRoutes;
