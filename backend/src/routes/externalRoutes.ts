import { Router } from "express";
import * as ExternalApiController from "../controllers/ExternalApiController";

const externalRoutes = Router();

externalRoutes.post(
  "/sendApiChatbotMessage",
  ExternalApiController.sendApiChatbotMessage
);

externalRoutes.post("/sendMessage", ExternalApiController.sendMessage);

externalRoutes.post("/sendMessageV2", ExternalApiController.sendMessageV2);

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
  "/incidencia/update-status",
  ExternalApiController.IncidenciaStatus
);

externalRoutes.post(
  "/incidencia/update-contact-domain",
  ExternalApiController.UpdateContactDomain
);

export default externalRoutes;
