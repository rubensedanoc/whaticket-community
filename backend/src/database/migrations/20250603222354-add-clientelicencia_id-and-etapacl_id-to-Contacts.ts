import { DataTypes, QueryInterface } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.addColumn("Contacts", "traza_clientelicencia_id", {
        type: DataTypes.INTEGER,
        allowNull: true
      }),
      queryInterface.addColumn("Contacts", "traza_clientelicencia_currentetapaid", {
        type: DataTypes.INTEGER,
        allowNull: true
      })
    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.removeColumn("Contacts", "traza_clientelicencia_id"),
      queryInterface.removeColumn("Contacts", "traza_clientelicencia_currentetapaid")
    ]);
  }
};
