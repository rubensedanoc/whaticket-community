import { DataTypes, QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tableDefinition = await queryInterface.describeTable("Tickets");

    if (!tableDefinition["incidenciaFlowActive"]) {
      await queryInterface.addColumn("Tickets", "incidenciaFlowActive", {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }

    if (!tableDefinition["incidenciaStatus"]) {
      await queryInterface.addColumn("Tickets", "incidenciaStatus", {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: "idle"
      });
    }

    if (!tableDefinition["incidenciaExternalId"]) {
      await queryInterface.addColumn("Tickets", "incidenciaExternalId", {
        type: DataTypes.STRING,
        allowNull: true
      });
    }

    if (!tableDefinition["incidenciaPathJson"]) {
      await queryInterface.addColumn("Tickets", "incidenciaPathJson", {
        type: DataTypes.TEXT,
        allowNull: true
      });
    }

    if (!tableDefinition["incidenciaLastAttemptAt"]) {
      await queryInterface.addColumn("Tickets", "incidenciaLastAttemptAt", {
        type: DataTypes.DATE,
        allowNull: true
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const tableDefinition = await queryInterface.describeTable("Tickets");

    if (tableDefinition["incidenciaLastAttemptAt"]) {
      await queryInterface.removeColumn("Tickets", "incidenciaLastAttemptAt");
    }

    if (tableDefinition["incidenciaPathJson"]) {
      await queryInterface.removeColumn("Tickets", "incidenciaPathJson");
    }

    if (tableDefinition["incidenciaExternalId"]) {
      await queryInterface.removeColumn("Tickets", "incidenciaExternalId");
    }

    if (tableDefinition["incidenciaStatus"]) {
      await queryInterface.removeColumn("Tickets", "incidenciaStatus");
    }

    if (tableDefinition["incidenciaFlowActive"]) {
      await queryInterface.removeColumn("Tickets", "incidenciaFlowActive");
    }
  }
};
