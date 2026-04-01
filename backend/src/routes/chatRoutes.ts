import express from "express";
import * as ChatController from "../controllers/ChatController";

const chatRoutes = express.Router();

chatRoutes.get("/chats/pending", ChatController.getPendingChats);

export default chatRoutes;
