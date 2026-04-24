import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tableDescription: any = await queryInterface.describeTable("Tickets");

    const columnsToAdd = [];

    if (!tableDescription.patienceMessageCount) {
      columnsToAdd.push(
        queryInterface.addColumn("Tickets", "patienceMessageCount", {
          type: DataTypes.INTEGER,
          allowNull: true,
          defaultValue: 0
        })
      );
    }

    if (!tableDescription.lastPatienceMessageAt) {
      columnsToAdd.push(
        queryInterface.addColumn("Tickets", "lastPatienceMessageAt", {
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

    if (tableDescription.patienceMessageCount) {
      columnsToRemove.push(
        queryInterface.removeColumn("Tickets", "patienceMessageCount")
      );
    }

    if (tableDescription.lastPatienceMessageAt) {
      columnsToRemove.push(
        queryInterface.removeColumn("Tickets", "lastPatienceMessageAt")
      );
    }

    return Promise.all(columnsToRemove);
  }
};
