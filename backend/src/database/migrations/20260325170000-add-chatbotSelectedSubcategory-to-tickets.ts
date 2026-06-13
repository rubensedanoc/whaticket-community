import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tableDescription: any = await queryInterface.describeTable("Tickets");
    if (!tableDescription.chatbotSelectedSubcategory) {
      return queryInterface.addColumn("Tickets", "chatbotSelectedSubcategory", {
        type: DataTypes.STRING,
        allowNull: true
      });
    }
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Tickets", "chatbotSelectedSubcategory");
  }
};
