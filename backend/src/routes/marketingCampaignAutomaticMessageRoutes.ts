import { Router } from "express";
import isAuth from "../middleware/isAuth";

import multer from "multer";
import uploadConfig from "../config/upload";

import * as MarketingCampaignAutomaticMessagesController from "../controllers/MarketingCampaignAutomaticMessagesController";

const marketingCampaignAutomaticMessageRoutes = Router();

const upload = multer(uploadConfig);

marketingCampaignAutomaticMessageRoutes.get(
  "/marketingCampaignAutomaticMessages",
  isAuth,
  MarketingCampaignAutomaticMessagesController.index
);

marketingCampaignAutomaticMessageRoutes.get(
  "/marketingCampaignAutomaticMessage/:marketingCampaignAutomaticMessageId",
  isAuth,
  MarketingCampaignAutomaticMessagesController.show
);

marketingCampaignAutomaticMessageRoutes.post(
  "/marketingCampaignAutomaticMessage",
  isAuth,
  upload.array("medias"),
  MarketingCampaignAutomaticMessagesController.store
);

marketingCampaignAutomaticMessageRoutes.put(
  "/marketingCampaignAutomaticMessage/:marketingCampaignAutomaticMessageId",
  isAuth,
  upload.array("medias"),
  MarketingCampaignAutomaticMessagesController.update
);

marketingCampaignAutomaticMessageRoutes.delete(
  "/marketingCampaignAutomaticMessage/:marketingCampaignAutomaticMessageId",
  isAuth,
  MarketingCampaignAutomaticMessagesController.remove
);

export default marketingCampaignAutomaticMessageRoutes;
