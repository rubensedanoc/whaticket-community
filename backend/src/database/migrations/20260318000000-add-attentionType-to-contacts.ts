import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Contacts", "attentionType", {
      type: DataTypes.ENUM("HIGH_TOUCH", "LOW_TOUCH", "TECH_TOUCH"),
      allowNull: true,
      defaultValue: null
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Contacts", "attentionType");
  }
};
