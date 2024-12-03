import { DataTypes, QueryInterface } from "sequelize";
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Tickets", "messagingCampaignId", {
      type: DataTypes.INTEGER,
      references: { model: "MessagingCampaigns", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
      allowNull: true
    });
  },
  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Tickets", "messagingCampaignId");
  }
};
