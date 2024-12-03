import { DataTypes, QueryInterface } from "sequelize";
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.createTable("MessagingCampaigns", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      timesSent: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
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
    return queryInterface.dropTable("MessagingCampaigns");
  }
};
