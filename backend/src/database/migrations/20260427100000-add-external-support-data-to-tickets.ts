import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tableDescription: any = await queryInterface.describeTable("Tickets");

    if (!tableDescription.externalSupportData) {
      await queryInterface.addColumn("Tickets", "externalSupportData", {
        type: DataTypes.TEXT,
        allowNull: true
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const tableDescription: any = await queryInterface.describeTable("Tickets");

    if (tableDescription.externalSupportData) {
      await queryInterface.removeColumn("Tickets", "externalSupportData");
    }
  }
};
