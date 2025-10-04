import { Router } from "express";
import * as ExternalApiController from "../controllers/ExternalApiController";

const externalRoutes = Router();

externalRoutes.post(
  "/sendApiChatbotMessage",
  ExternalApiController.sendApiChatbotMessage
);

externalRoutes.post("/sendMessage", ExternalApiController.sendMessage);

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

export default externalRoutes;
