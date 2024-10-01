import { Router } from "express";

import apiRoutes from "./apiRoutes";
import authRoutes from "./authRoutes";
import categoryRoutes from "./categoryRoutes";
import chatbotMessageRoutes from "./chatbotMessageRoutes";
import chatbotOptionRoutes from "./chatbotOptionRoutes";
import contactRoutes from "./contactRoutes";
import contryRoutes from "./countryRoutes";
import externalRoutes from "./externalRoutes";
import messageRoutes from "./messageRoutes";
import queueRoutes from "./queueRoutes";
import quickAnswerRoutes from "./quickAnswerRoutes";
import reportsRoutes from "./reports";
import settingRoutes from "./settingRoutes";
import ticketRoutes from "./ticketRoutes";
import userRoutes from "./userRoutes";
import whatsappRoutes from "./whatsappRoutes";
import whatsappSessionRoutes from "./whatsappSessionRoutes";

const routes = Router();

routes.use(userRoutes);
routes.use("/auth", authRoutes);
routes.use(settingRoutes);
routes.use(contactRoutes);
routes.use(ticketRoutes);
routes.use(whatsappRoutes);
routes.use(messageRoutes);
routes.use(whatsappSessionRoutes);
routes.use(queueRoutes);
routes.use(quickAnswerRoutes);
routes.use(categoryRoutes);
routes.use(chatbotOptionRoutes);
routes.use(reportsRoutes);
routes.use("/api/messages", apiRoutes);
routes.use(contryRoutes);
routes.use("/external", externalRoutes);
routes.use(chatbotMessageRoutes);

export default routes;
