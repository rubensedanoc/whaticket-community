import express from "express";
import isAuth from "../middleware/isAuth";

import * as ContactController from "../controllers/ContactController";
import * as ImportPhoneContactsController from "../controllers/ImportPhoneContactsController";

const contactRoutes = express.Router();

contactRoutes.post(
  "/contacts/import",
  isAuth,
  ImportPhoneContactsController.store
);

contactRoutes.get("/contacts", isAuth, ContactController.index);

contactRoutes.get("/contacts/:contactId", isAuth, ContactController.show);

contactRoutes.get("/contacts/getByNumber/:number", isAuth, ContactController.getByNumber);

contactRoutes.get(
  "/contacts-showWithActualTickets/:contactId",
  isAuth,
  ContactController.showWithActualTicketIds
);

contactRoutes.post(
  "/contacts/getContactTicketSummary",
  isAuth,
  ContactController.getContactTicketSummary
);

contactRoutes.get(
  "/getNumberGroups/:number",
  isAuth,
  ContactController.getNumberGroups
);

contactRoutes.get(
  "/getNumberGroupsByContactId/:contactId",
  isAuth,
  ContactController.getNumberGroupsByContactId
);

contactRoutes.post("/contacts", isAuth, ContactController.store);

contactRoutes.post("/contact", isAuth, ContactController.getContact);

contactRoutes.put("/contacts/:contactId", isAuth, ContactController.update);

contactRoutes.put("/contacts/removeClientelicencia/:contactId", isAuth, ContactController.removeClientelicencia);

contactRoutes.delete("/contacts/:contactId", isAuth, ContactController.remove);

contactRoutes.post("/contacts/sync-attention-types", isAuth, ContactController.syncAttentionTypes);

export default contactRoutes;


