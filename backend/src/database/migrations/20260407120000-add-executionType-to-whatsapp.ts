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
    if (!(await columnExists(queryInterface, "Whatsapps", "executionType"))) {
      await queryInterface.addColumn("Whatsapps", "executionType", {
        type: DataTypes.ENUM('reactive', 'proactive'),
        allowNull: false,
        defaultValue: 'reactive'
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    if (await columnExists(queryInterface, "Whatsapps", "executionType")) {
      await queryInterface.removeColumn("Whatsapps", "executionType");
      // Eliminar el ENUM type
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_Whatsapps_executionType";'
      );
    }
  }
};
