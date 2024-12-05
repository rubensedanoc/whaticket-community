import { DataTypes, QueryInterface } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.createTable("MarketingMessagingCampaignShipments", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      startTimestamp: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      endTimestamp: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      status: {
        type: DataTypes.STRING,
        defaultValue: "sending",
        allowNull: false
      },
      excelUrl: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      userId: {
        type: DataTypes.INTEGER,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: true
      },
      whatsappId: {
        type: DataTypes.INTEGER,
        references: { model: "Whatsapps", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: true
      },
      marketingMessagingCampaignId: {
        type: DataTypes.INTEGER,
        references: { model: "MarketingMessagingCampaigns", key: "id" },
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
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("MarketingMessagingCampaignShipments");
  }
};
