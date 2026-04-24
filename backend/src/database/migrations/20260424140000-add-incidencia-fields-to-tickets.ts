import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tableDescription: any = await queryInterface.describeTable("Tickets");

    const columnsToAdd = [];

    if (!tableDescription.incidenciaPathJson) {
      columnsToAdd.push(
        queryInterface.addColumn("Tickets", "incidenciaPathJson", {
          type: DataTypes.TEXT,
          allowNull: true
        })
      );
    }

    if (!tableDescription.incidenciaExternalId) {
      columnsToAdd.push(
        queryInterface.addColumn("Tickets", "incidenciaExternalId", {
          type: DataTypes.STRING,
          allowNull: true
        })
      );
    }

    if (!tableDescription.incidenciaLastAttemptAt) {
      columnsToAdd.push(
        queryInterface.addColumn("Tickets", "incidenciaLastAttemptAt", {
          type: DataTypes.DATE,
          allowNull: true
        })
      );
    }

    return Promise.all(columnsToAdd);
  },

  down: async (queryInterface: QueryInterface) => {
    const tableDescription: any = await queryInterface.describeTable("Tickets");

    const columnsToRemove = [];

    if (tableDescription.incidenciaPathJson) {
      columnsToRemove.push(
        queryInterface.removeColumn("Tickets", "incidenciaPathJson")
      );
    }

    if (tableDescription.incidenciaExternalId) {
      columnsToRemove.push(
        queryInterface.removeColumn("Tickets", "incidenciaExternalId")
      );
    }

    if (tableDescription.incidenciaLastAttemptAt) {
      columnsToRemove.push(
        queryInterface.removeColumn("Tickets", "incidenciaLastAttemptAt")
      );
    }

    return Promise.all(columnsToRemove);
  }
};
