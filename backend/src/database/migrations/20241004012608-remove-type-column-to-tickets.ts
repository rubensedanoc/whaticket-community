import { DataTypes, QueryInterface } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Tickets", "type");
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Tickets", "type", {
      type: DataTypes.STRING,
      defaultValue: "normal",
      allowNull: true
    });
  }
};
