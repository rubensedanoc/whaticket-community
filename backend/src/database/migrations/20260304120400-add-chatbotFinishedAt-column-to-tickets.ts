import { DataTypes, QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tableDescription: any = await queryInterface.describeTable("Tickets");
    if (!tableDescription.chatbotFinishedAt) {
      return queryInterface.addColumn("Tickets", "chatbotFinishedAt", {
        type: DataTypes.DATE,
        allowNull: true
      });
    }
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Tickets", "chatbotFinishedAt");
  }
};
