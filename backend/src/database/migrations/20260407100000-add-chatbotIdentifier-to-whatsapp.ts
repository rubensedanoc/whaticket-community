import { QueryInterface, DataTypes } from "sequelize";

async function columnExists(
  queryInterface: QueryInterface,
  tableName: string,
  columnName: string
): Promise<boolean> {
  const tableDescription = await queryInterface.describeTable(tableName);
  return columnName in tableDescription;
}

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    if (!(await columnExists(queryInterface, "Whatsapps", "chatbotIdentifier"))) {
      await queryInterface.addColumn("Whatsapps", "chatbotIdentifier", {
        type: DataTypes.STRING,
        allowNull: true
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    if (await columnExists(queryInterface, "Whatsapps", "chatbotIdentifier")) {
      await queryInterface.removeColumn("Whatsapps", "chatbotIdentifier");
    }
  }
};
