import express from "express";
import isAuth from "../middleware/isAuth";

import * as TicketController from "../controllers/TicketController";

const ticketRoutes = express.Router();

ticketRoutes.get("/tickets", isAuth, TicketController.index);

ticketRoutes.get("/tickets/advanced", isAuth, TicketController.advancedIndex);

ticketRoutes.get("/tickets/:ticketId", isAuth, TicketController.show);

ticketRoutes.get(
  "/showParticipants/:ticketId",
  isAuth,
  TicketController.ShowParticipants
);

ticketRoutes.get(
  "/showAllRelatedTickets/:ticketId",
  isAuth,
  TicketController.showAllRelatedTickets
);

ticketRoutes.post("/tickets", isAuth, TicketController.store);

ticketRoutes.post("/ticketLog", isAuth, TicketController.createTicketLog);

ticketRoutes.put("/tickets/:ticketId", isAuth, TicketController.update);

ticketRoutes.delete("/tickets/:ticketId", isAuth, TicketController.remove);

ticketRoutes.post(
  "/tickets/getAndSetBeenWaitingSinceTimestampToAllTheTickets",
  TicketController.getAndSetBeenWaitingSinceTimestampToAllTheTickets
);

export default ticketRoutes;
