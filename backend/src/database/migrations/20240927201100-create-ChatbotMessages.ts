import { DataTypes, QueryInterface } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.createTable("ChatbotMessages", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      identifier: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      mediaType: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      mediaUrl: {
        type: DataTypes.TEXT
      },
      title: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      value: {
        type: DataTypes.TEXT
      },
      hasSubOptions: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      fatherChatbotOptionId: {
        type: DataTypes.INTEGER,
        references: { model: "ChatbotMessages", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
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
    return queryInterface.dropTable("ChatbotMessages");
  }
};
