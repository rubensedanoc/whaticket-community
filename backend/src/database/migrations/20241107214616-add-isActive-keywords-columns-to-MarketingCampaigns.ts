import { DataTypes, QueryInterface } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.addColumn("MarketingCampaigns", "isActive", {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      }),
      queryInterface.addColumn("MarketingCampaigns", "keywords", {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: "[]"
      })
    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.removeColumn("MarketingCampaigns", "isActive"),
      queryInterface.removeColumn("MarketingCampaigns", "keywords")
    ]);
  }
};
