import { DataTypes, QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    return queryInterface.sequelize.transaction(t => {
      return Promise.all([
        queryInterface.changeColumn(
          "MarketingCampaignAutomaticMessages",
          "marketingCampaignId",
          {
            type: DataTypes.INTEGER,
            allowNull: true // Permite valores NULL
          },
          { transaction: t }
        )
      ]);
    });
  },

  down: async (queryInterface: QueryInterface) => {
    return queryInterface.sequelize.transaction(t => {
      return Promise.all([
        queryInterface.changeColumn(
          "MarketingCampaignAutomaticMessages",
          "marketingCampaignId",
          {
            type: DataTypes.INTEGER,
            allowNull: false // Permite valores NULL
          },
          { transaction: t }
        )
      ]);
    });
  }
};
