import { DataTypes, QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tableDefinition = await queryInterface.describeTable("Tickets");

    if (!tableDefinition["incidenciaLastContentionAt"]) {
      await queryInterface.addColumn("Tickets", "incidenciaLastContentionAt", {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null
      });
    }

    if (!tableDefinition["incidenciaEscalated"]) {
      await queryInterface.addColumn("Tickets", "incidenciaEscalated", {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const tableDefinition = await queryInterface.describeTable("Tickets");

    if (tableDefinition["incidenciaLastContentionAt"]) {
      await queryInterface.removeColumn("Tickets", "incidenciaLastContentionAt");
    }

    if (tableDefinition["incidenciaEscalated"]) {
      await queryInterface.removeColumn("Tickets", "incidenciaEscalated");
    }
  }
};
