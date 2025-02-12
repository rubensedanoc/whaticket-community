import { DataTypes, QueryInterface } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.addColumn("Categories", "isDefault", {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      })
    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.removeColumn("Categories", "isDefault")
    ]);
  }
};
