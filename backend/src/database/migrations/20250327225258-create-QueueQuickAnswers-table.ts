import { DATE, INTEGER, QueryInterface } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.createTable("QueueQuickAnswers", {
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
      quickAnswerId: {
        type: INTEGER,
        references: { model: "QuickAnswers", key: "id" },
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
    return queryInterface.dropTable("QueueQuickAnswers");
  }
};
