import { DataTypes, QueryInterface } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("ChatbotMessages", "messageType", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("ChatbotMessages", "messageType");
  }
};
