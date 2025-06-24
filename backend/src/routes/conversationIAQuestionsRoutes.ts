import express from "express";
import isAuth from "../middleware/isAuth";

import * as ConversationIAQuestionsController from "../controllers/ConversationIAQuestionsController";

const conversationIAQuestionsRoutes = express.Router();

conversationIAQuestionsRoutes.get("/conversationIAQuestion/:ticketId", isAuth, ConversationIAQuestionsController.index);

conversationIAQuestionsRoutes.post("/conversationIAQuestion", isAuth, ConversationIAQuestionsController.store);

export default conversationIAQuestionsRoutes;
