import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) =>
    queryInterface.addColumn("Messages", "sendStatus", {
      type: DataTypes.STRING,
      allowNull: true
    }),

  down: (queryInterface: QueryInterface) =>
    queryInterface.removeColumn("Messages", "sendStatus")
};
