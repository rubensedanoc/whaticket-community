import express from "express";

import * as GroupController from "../controllers/GroupController";

const groupRoutes = express.Router();

// Endpoints sin autenticación para uso desde n8n
groupRoutes.get("/groups/with-alta", GroupController.listGroupsWithAlta);

groupRoutes.post("/groups/:ticketId/leave", GroupController.leaveGroup);

export default groupRoutes;
