import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // 1. Agregar columna ticketId
    await queryInterface.addColumn("ProactiveBotSessions", "ticketId", {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Tickets',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // 2. Modificar enum de status para incluir DECLINED y TIMEOUT
    await queryInterface.changeColumn("ProactiveBotSessions", "status", {
      type: DataTypes.ENUM('ACTIVE', 'COMPLETED', 'DECLINED', 'NO_RESPONSE', 'TIMEOUT', 'FAILED'),
      allowNull: false,
      defaultValue: 'ACTIVE'
    });
  },

  down: async (queryInterface: QueryInterface) => {
    // Revertir cambios
    await queryInterface.removeColumn("ProactiveBotSessions", "ticketId");
    
    await queryInterface.changeColumn("ProactiveBotSessions", "status", {
      type: DataTypes.ENUM('ACTIVE', 'COMPLETED', 'NO_RESPONSE', 'FAILED'),
      allowNull: false,
      defaultValue: 'ACTIVE'
    });
  }
};
