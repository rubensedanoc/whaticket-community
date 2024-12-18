import { DataTypes, QueryInterface } from "sequelize";
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.createTable("SendMessageRequests", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      fromNumber: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      toNumber: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      status: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: "pending"
      },
      timesAttempted: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      lastAttemptAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });
  },
  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("SendMessageRequests");
  }
};
