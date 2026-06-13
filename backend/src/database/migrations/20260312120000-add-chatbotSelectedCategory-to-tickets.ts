import { DataTypes, QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tableDescription: any = await queryInterface.describeTable("Tickets");
    if (!tableDescription.chatbotSelectedCategory) {
      return queryInterface.addColumn("Tickets", "chatbotSelectedCategory", {
        type: DataTypes.STRING,
        allowNull: true
      });
    }
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Tickets", "chatbotSelectedCategory");
  }
};
