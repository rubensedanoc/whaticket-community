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

reportsRoutes.get("/reportHistory", isAuth, ReportsController.reportHistory);
reportsRoutes.get(
  "/reportHistoryWithDateRange",
  isAuth,
  ReportsController.reportHistoryWithDateRange
);
reportsRoutes.get("/reportToExcel", isAuth, ReportsController.reportToExcel);
reportsRoutes.get("/reportToExcelForIA", isAuth, ReportsController.reportToExcelForIA);
reportsRoutes.get("/reportToUsers", isAuth, ReportsController.reportToUsers);
reportsRoutes.get(
  "/chatbotMessagesReportToExcel",
  isAuth,
  ReportsController.chatbotMessagesReportToExcel
);

// ----------------- comercial reports page
reportsRoutes.get(
  "/getTicketsDistributionByStages",
  isAuth,
  ReportsController.getTicketsDistributionByStages
);
reportsRoutes.get(
  "/getTicketsDistributionByStagesForExcel",
  isAuth,
  ReportsController.getTicketsDistributionByStagesForExcel
);

export default reportsRoutes;
