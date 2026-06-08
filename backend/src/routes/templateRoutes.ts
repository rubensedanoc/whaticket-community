import { Router } from "express";
import isAuth from "../middleware/isAuth";

import * as TemplateController from "../controllers/TemplateController";

const templateRoutes = Router();

templateRoutes.post(
  "/templates/resolve",
  isAuth,
  TemplateController.resolve
);

export default templateRoutes;
