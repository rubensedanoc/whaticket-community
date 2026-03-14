import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Tickets", "etapa_alta_assigned_at", {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Fecha en que el ticket fue asignado a etapa ALTA (5)"
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Tickets", "etapa_alta_assigned_at");
  }
};
