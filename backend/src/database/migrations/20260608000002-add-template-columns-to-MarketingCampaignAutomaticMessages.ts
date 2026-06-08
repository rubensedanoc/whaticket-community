import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tableDescription: any = await queryInterface.describeTable("MarketingCampaignAutomaticMessages");

    if (!tableDescription.templatePayload) {
      await queryInterface.addColumn("MarketingCampaignAutomaticMessages", "templatePayload", {
        type: DataTypes.JSON,
        allowNull: true
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("MarketingCampaignAutomaticMessages", "templatePayload");
  }
};
