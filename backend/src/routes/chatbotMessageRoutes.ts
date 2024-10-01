import { Router } from "express";
import multer from "multer";
import uploadConfig from "../config/upload";
import isAuth from "../middleware/isAuth";

import * as ChatbotMessageController from "../controllers/ChatbotMessageController";

const chatbotMessageRoutes = Router();

const upload = multer(uploadConfig);

chatbotMessageRoutes.get(
  "/chatbotMessages",
  isAuth,
  ChatbotMessageController.index
);

chatbotMessageRoutes.post(
  "/chatbotMessage",
  isAuth,
  ChatbotMessageController.store
);

chatbotMessageRoutes.get(
  "/chatbotMessage/:chatbotMessageId",
  isAuth,
  ChatbotMessageController.show
);

chatbotMessageRoutes.put(
  "/chatbotMessage/:chatbotMessageId",
  isAuth,
  ChatbotMessageController.update
);

chatbotMessageRoutes.delete(
  "/chatbotMessage/:chatbotMessageId",
  isAuth,
  ChatbotMessageController.remove
);

export default chatbotMessageRoutes;
