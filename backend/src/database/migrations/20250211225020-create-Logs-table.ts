import { DataTypes, QueryInterface } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.createTable("Logs", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      startTimestamp: {
        type: DataTypes.BIGINT,
        allowNull: true
      },
      endTimestamp: {
        type: DataTypes.BIGINT,
        allowNull: true
      },
      incomingEndpoint: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      incomingData: {
        type: DataTypes.JSON,
        allowNull: true
      },
      outgoingEndpoint: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      outgoingData: {
        type: DataTypes.JSON,
        allowNull: true
      },
      status: {
        type: DataTypes.STRING,
        allowNull: true
      },
      wasOk: {
        type: DataTypes.BOOLEAN,
        allowNull: true
      },
      logs: {
        type: DataTypes.JSON,
        allowNull: true
      },
      error: {
        type: DataTypes.JSON,
        allowNull: true
      },
      userId: {
        type: DataTypes.INTEGER,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
      },
      oldUserId: {
        type: DataTypes.INTEGER,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
      },
      newUserId: {
        type: DataTypes.INTEGER,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
      },
      contactId: {
        type: DataTypes.INTEGER,
        references: { model: "Contacts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
      },
      ticketId: {
        type: DataTypes.INTEGER,
        references: { model: "Tickets", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
      },
      whatsappId: {
        type: DataTypes.INTEGER,
        references: { model: "Whatsapps", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
      },
      marketingCampaignId: {
        type: DataTypes.INTEGER,
        references: { model: "MarketingCampaigns", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
      },
      logTypeId: {
        type: DataTypes.INTEGER,
        references: { model: "LogTypes", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
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
    return queryInterface.dropTable("Logs");
  }
};
