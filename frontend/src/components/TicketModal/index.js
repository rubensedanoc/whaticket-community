import React from "react";
import Ticket from "../Ticket";

import { Dialog, DialogContent } from "@material-ui/core";

const TicketModal = ({ open, onClose }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" scroll="paper">
      <DialogContent style={{ padding: 0, width: "85rem", height: "90vh", maxWidth: "100%" }}>
        <Ticket />
      </DialogContent>
    </Dialog>
  );
};

export default TicketModal;
