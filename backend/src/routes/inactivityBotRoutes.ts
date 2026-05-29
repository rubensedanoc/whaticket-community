import { Router } from "express";
import * as InactivityBotController from "../controllers/InactivityBotController";

const inactivityBotRoutes = Router();

inactivityBotRoutes.post(
  "/inactivity-bot",
  InactivityBotController.triggerInactivityBot
);

export default inactivityBotRoutes;
