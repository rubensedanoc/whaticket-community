import { DataTypes, QueryInterface } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.createTable(
      "MarketingMessagingCampaignShipmentNumbers",
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        number: {
          type: DataTypes.STRING,
          allowNull: false
        },
        hadError: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          allowNull: false
        },
        marketingMessagingCampaignShipmentId: {
          type: DataTypes.INTEGER,
          references: {
            model: "MarketingMessagingCampaignShipments",
            key: "id"
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          allowNull: true
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false
        }
      }
    );
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable(
      "MarketingMessagingCampaignShipmentNumbers"
    );
  }
};
