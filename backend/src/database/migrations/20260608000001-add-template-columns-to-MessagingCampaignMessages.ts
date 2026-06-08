import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tableDescription: any = await queryInterface.describeTable("MessagingCampaignMessages");

    if (!tableDescription.templatePayload) {
      await queryInterface.addColumn("MessagingCampaignMessages", "templatePayload", {
        type: DataTypes.JSON,
        allowNull: true
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("MessagingCampaignMessages", "templatePayload");
  }
};
