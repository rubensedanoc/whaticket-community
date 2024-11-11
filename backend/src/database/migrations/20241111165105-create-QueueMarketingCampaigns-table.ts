import { DATE, INTEGER, QueryInterface } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.createTable("QueueMarketingCampaigns", {
      id: {
        type: INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      queueId: {
        type: INTEGER,
        references: { model: "Queues", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      marketingCampaignId: {
        type: INTEGER,
        references: { model: "MarketingCampaigns", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      createdAt: {
        type: DATE,
        allowNull: false
      },
      updatedAt: {
        type: DATE,
        allowNull: false
      }
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("QueueMarketingCampaigns");
  }
};
