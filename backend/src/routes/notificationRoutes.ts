import express from "express";
import isAuth from "../middleware/isAuth";

import * as NotificationController from "../controllers/NotificationController";

const notificationRoutes = express.Router();

notificationRoutes.get("/notifications", isAuth, NotificationController.index);

notificationRoutes.get("/notifications/getNotificationsCountForUser", isAuth, NotificationController.getNotificationsCountForUser);

notificationRoutes.post("/notifications/seenNotification", isAuth, NotificationController.seenNotification);

export default notificationRoutes;
