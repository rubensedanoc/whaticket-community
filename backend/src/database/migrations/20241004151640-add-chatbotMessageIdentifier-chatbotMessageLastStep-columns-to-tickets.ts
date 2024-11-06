import { DataTypes, QueryInterface } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.addColumn("Tickets", "chatbotMessageIdentifier", {
        type: DataTypes.STRING,
        allowNull: true
      }),
      queryInterface.addColumn("Tickets", "chatbotMessageLastStep", {
        type: DataTypes.STRING,
        allowNull: true
      })
    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.removeColumn("Tickets", "chatbotMessageIdentifier"),
      queryInterface.removeColumn("Tickets", "chatbotMessageLastStep")
    ]);
  }
};
