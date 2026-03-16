import { DataTypes, QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tableDefinition = await queryInterface.describeTable("Tickets");

    if (!tableDefinition["incidenciaContentionCount"]) {
      await queryInterface.addColumn("Tickets", "incidenciaContentionCount", {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const tableDefinition = await queryInterface.describeTable("Tickets");

    if (tableDefinition["incidenciaContentionCount"]) {
      await queryInterface.removeColumn("Tickets", "incidenciaContentionCount");
    }
  }
};
