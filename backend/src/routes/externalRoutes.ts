import { Router } from "express";
import * as ExternalApiController from "../controllers/ExternalApiController";
import * as ReportsController from "../controllers/ReportsController";
import * as PublicTicketsController from "../controllers/PublicTicketsController";

const externalRoutes = Router();

externalRoutes.post(
  "/sendApiChatbotMessage",
  ExternalApiController.sendApiChatbotMessage
);

externalRoutes.post("/sendMessage", ExternalApiController.sendMessage);

externalRoutes.post("/sendMessageV2", ExternalApiController.sendMessageV2);

externalRoutes.post("/sendMessageAddon", ExternalApiController.sendMessageAddon);

externalRoutes.post(
  "/sendMakeMessaginCampaign",
  ExternalApiController.sendMakeMessaginCampaign
);

externalRoutes.post(
  "/sendMarketingCampaignIntro",
  ExternalApiController.sendMarketingCampaignIntro
);

externalRoutes.post(
  "/sendImageMessage",
  ExternalApiController.sendImageMessage
);

externalRoutes.post(
  "/updateFromTrazaByClientelicenciaId",
  ExternalApiController.updateFromTrazaByClientelicenciaId
);

externalRoutes.post(
  "/getConversationMessages",
  ExternalApiController.getConversationMessages
);

externalRoutes.post(
  "/getConversationMessagesv2",
  ExternalApiController.getConversationMessagesV2
);

externalRoutes.post(
  "/getConversationMessagesFromTicket",
  ExternalApiController.getConversationMessagesFromTicket
);

externalRoutes.post(
  "/getUpdatedTickets",
  ExternalApiController.getUpdatedTickets
);

externalRoutes.post(
  "/findGroupByName",
  ExternalApiController.findGroupByName
);

externalRoutes.post(
  "/sendMessageToTicket",
  ExternalApiController.sendMessageToTicket
);

externalRoutes.post(
  "/sendMessageToContact",
  ExternalApiController.sendMessageToContact
);

externalRoutes.post(
  "/fixGroupNames",
  ExternalApiController.fixGroupNames
);

externalRoutes.get(
  "/reportToExcelDaily",
  ReportsController.reportToExcelPublic
);

externalRoutes.get(
  "/getTicketsByClientelicenciaId",
  ExternalApiController.getTicketsByClientelicenciaId
);

externalRoutes.get(
  "/getNotificationHistory",
  ExternalApiController.getNotificationHistory
);

// API pública de tickets para verificación E2E (sin autenticación interna)
// GET /external/tickets?year=2026&page=1&pageSize=200
externalRoutes.get("/tickets", PublicTicketsController.index);

// GET /external/tickets/:ticketId
externalRoutes.get("/tickets/:ticketId", PublicTicketsController.show);

export default externalRoutes;
