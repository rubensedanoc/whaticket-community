import { Router } from "express";
import isAuth from "../middleware/isAuth";

import multer from "multer";
import uploadConfig from "../config/upload";

import * as MessagingCampaignController from "../controllers/MessagingCampaignController";

const messagingCampaignRoutes = Router();

const upload = multer(uploadConfig);

messagingCampaignRoutes.get(
  "/messagingCampaigns",
  isAuth,
  MessagingCampaignController.index
);

messagingCampaignRoutes.get(
  "/messagingCampaigns/:messagingCampaignId",
  isAuth,
  MessagingCampaignController.show
);

messagingCampaignRoutes.post(
  "/messagingCampaigns",
  isAuth,
  upload.array("medias"),
  MessagingCampaignController.store
);

messagingCampaignRoutes.put(
  "/messagingCampaigns/:messagingCampaignId",
  isAuth,
  upload.array("medias"),
  MessagingCampaignController.update
);

messagingCampaignRoutes.delete(
  "/messagingCampaigns/:messagingCampaignId",
  isAuth,
  MessagingCampaignController.remove
);

// -----

messagingCampaignRoutes.post(
  "/messagingCampaigns/send",
  isAuth,
  upload.array("medias"),
  MessagingCampaignController.send
);

messagingCampaignRoutes.post(
  "/messagingCampaigns/cancel",
  isAuth,
  MessagingCampaignController.cancel
);

export default messagingCampaignRoutes;
