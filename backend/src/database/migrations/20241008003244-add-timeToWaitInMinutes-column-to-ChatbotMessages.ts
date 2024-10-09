import { DataTypes, QueryInterface } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("ChatbotMessages", "timeToWaitInMinutes", {
      type: DataTypes.INTEGER,
      allowNull: true
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn(
      "ChatbotMessages",
      "timeToWaitInMinutes"
    );
  }
};
