import { DataTypes, QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tableDefinition = await queryInterface.describeTable("ChatbotMessages");

    if (!tableDefinition["flujoConIncidencia"]) {
      await queryInterface.addColumn("ChatbotMessages", "flujoConIncidencia", {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const tableDefinition = await queryInterface.describeTable("ChatbotMessages");

    if (tableDefinition["flujoConIncidencia"]) {
      await queryInterface.removeColumn("ChatbotMessages", "flujoConIncidencia");
    }
  }
};
