import { DataTypes, QueryInterface } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Tickets", "marketingMessagingCampaignId", {
      type: DataTypes.INTEGER,
      references: { model: "MarketingMessagingCampaigns", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
      allowNull: true
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn(
      "Tickets",
      "marketingMessagingCampaignId"
    );
  }
};