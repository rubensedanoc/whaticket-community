import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.createTable("ProactiveBotSessions", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      phone: {
        type: DataTypes.STRING(20),
        allowNull: false
      },
      whatsappId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Whatsapps", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      botIdentifier: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'inactividad'
      },
      status: {
        type: DataTypes.ENUM('ACTIVE', 'COMPLETED', 'NO_RESPONSE', 'FAILED'),
        allowNull: false,
        defaultValue: 'ACTIVE'
      },
      currentStep: {
        type: DataTypes.STRING,
        allowNull: true
      },
      userResponsesHistory: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      userFreeTextResponse: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      waitingForFreeTextSince: {
        type: DataTypes.DATE,
        allowNull: true
      },
      timeoutMinutes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 5
      },
      startedAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      completedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      sentToExternalSystemAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE(6),
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE(6),
        allowNull: false
      }
    }).then(() => {
      return Promise.all([
        queryInterface.addIndex("ProactiveBotSessions", ["phone"], {
          name: "idx_proactive_bot_sessions_phone"
        }),
        queryInterface.addIndex("ProactiveBotSessions", ["status"], {
          name: "idx_proactive_bot_sessions_status"
        }),
        queryInterface.addIndex("ProactiveBotSessions", ["whatsappId"], {
          name: "idx_proactive_bot_sessions_whatsapp_id"
        })
      ]);
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("ProactiveBotSessions");
  }
};
