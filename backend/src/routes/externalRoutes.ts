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
  "/sendImageMessage",
  ExternalApiController.sendImageMessage
);

export default externalRoutes;
