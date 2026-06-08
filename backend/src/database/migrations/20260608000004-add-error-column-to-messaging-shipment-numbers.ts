import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tableDescription: any = await queryInterface.describeTable("MessagingCampaignShipmentNumbers");

    if (!tableDescription.error) {
      await queryInterface.addColumn("MessagingCampaignShipmentNumbers", "error", {
        type: DataTypes.TEXT,
        allowNull: true
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("MessagingCampaignShipmentNumbers", "error");
  }
};
