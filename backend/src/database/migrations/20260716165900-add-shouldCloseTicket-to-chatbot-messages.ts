import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tableDescription: any = await queryInterface.describeTable("ChatbotMessages");

    if (!tableDescription.shouldCloseTicket) {
      return queryInterface.addColumn("ChatbotMessages", "shouldCloseTicket", {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const tableDescription: any = await queryInterface.describeTable("ChatbotMessages");

    if (tableDescription.shouldCloseTicket) {
      return queryInterface.removeColumn("ChatbotMessages", "shouldCloseTicket");
    }
  }
};
