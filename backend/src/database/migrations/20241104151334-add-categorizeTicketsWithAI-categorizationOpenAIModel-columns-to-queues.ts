import { DataTypes, QueryInterface } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.addColumn("Queues", "categorizeTicketsWithAI", {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
      }),
      queryInterface.addColumn("Queues", "categorizationOpenAIModel", {
        type: DataTypes.STRING,
        allowNull: true
      })
    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.removeColumn("Queues", "categorizeTicketsWithAI"),
      queryInterface.removeColumn("Queues", "categorizationOpenAIModel")
    ]);
  }
};
