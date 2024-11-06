import { DataTypes, QueryInterface } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.addColumn("ChatbotMessages", "isActive", {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false
      }),
      queryInterface.addColumn("ChatbotMessages", "label", {
        type: DataTypes.STRING,
        allowNull: true
      }),
      queryInterface.addColumn("ChatbotMessages", "order", {
        type: DataTypes.INTEGER,
        allowNull: true
      })
    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.removeColumn("ChatbotMessages", "isActive"),
      queryInterface.removeColumn("ChatbotMessages", "label")
    ]);
  }
};
