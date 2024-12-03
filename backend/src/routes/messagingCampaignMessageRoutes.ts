import { Router } from "express";
import isAuth from "../middleware/isAuth";

import multer from "multer";
import uploadConfig from "../config/upload";

import * as messagingCampaignMessageController from "../controllers/MessagingCampaignMessageController";

const messagingCampaignMessageRoutes = Router();

const upload = multer(uploadConfig);

messagingCampaignMessageRoutes.get(
  "/messagingCampaignMessages",
  isAuth,
  messagingCampaignMessageController.index
);

messagingCampaignMessageRoutes.get(
  "/messagingCampaignMessages/:messagingCampaignMessageId",
  isAuth,
  messagingCampaignMessageController.show
);

messagingCampaignMessageRoutes.post(
  "/messagingCampaignMessages",
  isAuth,
  upload.array("medias"),
  messagingCampaignMessageController.store
);

messagingCampaignMessageRoutes.put(
  "/messagingCampaignMessages/:messagingCampaignMessageId",
  isAuth,
  upload.array("medias"),
  messagingCampaignMessageController.update
);

messagingCampaignMessageRoutes.delete(
  "/messagingCampaignMessages/:messagingCampaignMessageId",
  isAuth,
  messagingCampaignMessageController.remove
);

export default messagingCampaignMessageRoutes;
