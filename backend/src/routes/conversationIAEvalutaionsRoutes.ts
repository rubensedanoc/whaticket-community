import express from "express";
import isAuth from "../middleware/isAuth";

import * as ConversationIAEvalutaionsController from "../controllers/ConversationIAEvalutaionsController";

const conversationIAEvalutaionsRoutes = express.Router();

conversationIAEvalutaionsRoutes.post("/conversationIAEvalutaion/analize", isAuth, ConversationIAEvalutaionsController.analize);

conversationIAEvalutaionsRoutes.post("/conversationIAEvalutaion/addColumnToResults", isAuth, ConversationIAEvalutaionsController.addColumnToResults);

export default conversationIAEvalutaionsRoutes;
