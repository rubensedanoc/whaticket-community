import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = await queryInterface.describeTable("Contacts") as any;
    
    if (!table.attentionType) {
      return queryInterface.addColumn("Contacts", "attentionType", {
        type: DataTypes.ENUM("HIGH_TOUCH", "LOW_TOUCH", "TECH_TOUCH"),
        allowNull: true,
        defaultValue: null
      });
    }
    
    return Promise.resolve();
  },

  down: async (queryInterface: QueryInterface) => {
    const table = await queryInterface.describeTable("Contacts") as any;
    
    if (table.attentionType) {
      return queryInterface.removeColumn("Contacts", "attentionType");
    }
    
    return Promise.resolve();
  }
};
