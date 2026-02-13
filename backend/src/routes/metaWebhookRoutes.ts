import express from "express";
import * as MetaWebhookController from "../controllers/MetaWebhookController";
import { rawBodyMiddleware } from "../middleware/rawBodyMiddleware";

const metaWebhookRoutes = express.Router();

metaWebhookRoutes.get("/meta/webhook", MetaWebhookController.verifyWebhook);

metaWebhookRoutes.post("/meta/webhook", rawBodyMiddleware, MetaWebhookController.receiveWebhook);

export default metaWebhookRoutes;
