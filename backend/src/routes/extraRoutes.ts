import { Router } from "express";
import isAuth from "../middleware/isAuth";

import * as ExtraController from "../controllers/ExtraController";

const extraRoutes = Router();

extraRoutes.post(
  "/getTicketDataToSendToZapier",
  isAuth,
  ExtraController.getTicketDataToSendToZapier
);

extraRoutes.post(
  "/sendTicketDataToZapier",
  isAuth,
  ExtraController.sendTicketDataToZapier
);

export default extraRoutes;
