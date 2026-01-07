import { Router } from "express";
import isAuth from "../middleware/isAuth";

import * as ReportsController from "../controllers/ReportsController";

const reportsRoutes = Router();

// ⚠️ REPORTES COMENTADOS - Alto consumo de CPU/DB
// reportsRoutes.get("/generalReport", isAuth, ReportsController.generalReport);

// reportsRoutes.get(
//   "/getOpenOrPendingTicketsWithLastMessages",
//   isAuth,
//   ReportsController.getOpenOrPendingTicketsWithLastMessages
// );

// reportsRoutes.get(
//   "/getATicketsList",
//   isAuth,
//   ReportsController.getATicketsList
// );

// reportsRoutes.get("/reportHistory", ReportsController.reportHistory);
// reportsRoutes.get(
//   "/reportHistoryWithDateRange",
//   ReportsController.reportHistoryWithDateRange
// );
// reportsRoutes.get("/reportToExcel", ReportsController.reportToExcel);
// reportsRoutes.get("/reportToExcelForIA", ReportsController.reportToExcelForIA);
// reportsRoutes.get("/reportToUsers", ReportsController.reportToUsers);
// reportsRoutes.get(
//   "/chatbotMessagesReportToExcel",
//   ReportsController.chatbotMessagesReportToExcel
// );

// ----------------- comercial reports page
// reportsRoutes.get(
//   "/getTicketsDistributionByStages",
//   ReportsController.getTicketsDistributionByStages
// );
// reportsRoutes.get(
//   "/getTicketsDistributionByStagesForExcel",
//   ReportsController.getTicketsDistributionByStagesForExcel
// );

export default reportsRoutes;
