import { DataTypes, QueryInterface } from "sequelize";
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Tickets", "messagingCampaignShipmentId", {
      type: DataTypes.INTEGER,
      references: { model: "MessagingCampaignShipments", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
      allowNull: true
    });
  },
  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn(
      "Tickets",
      "messagingCampaignShipmentId"
    );
  }
};
