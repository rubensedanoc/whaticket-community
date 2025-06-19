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

externalRoutes.get(
  "/getConversationMessages/:fecha_inicio/:fecha_fin/:user_id",
  ExternalApiController.getConversationMessages
);

export default externalRoutes;
