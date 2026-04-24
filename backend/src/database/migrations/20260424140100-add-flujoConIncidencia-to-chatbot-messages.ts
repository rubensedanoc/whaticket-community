import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tableDescription: any = await queryInterface.describeTable("ChatbotMessages");

    if (!tableDescription.flujoConIncidencia) {
      return queryInterface.addColumn("ChatbotMessages", "flujoConIncidencia", {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const tableDescription: any = await queryInterface.describeTable("ChatbotMessages");

    if (tableDescription.flujoConIncidencia) {
      return queryInterface.removeColumn("ChatbotMessages", "flujoConIncidencia");
    }
  }
};
