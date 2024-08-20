import { Router } from "express";
import * as ExternalApiController from "../controllers/ExternalApiController";

const externalRoutes = Router();

externalRoutes.post("/sendMessage", ExternalApiController.sendMessage);

export default externalRoutes;
