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
    if (!(await columnExists(queryInterface, "Whatsapps", "apiType"))) {
      await queryInterface.addColumn("Whatsapps", "apiType", {
        type: DataTypes.STRING,
        defaultValue: "whatsapp-web.js",
        allowNull: false
      });
    }

    if (!(await columnExists(queryInterface, "Whatsapps", "phoneNumberId"))) {
      await queryInterface.addColumn("Whatsapps", "phoneNumberId", {
        type: DataTypes.STRING,
        allowNull: true
      });
    }

    if (!(await columnExists(queryInterface, "Whatsapps", "metaAccessToken"))) {
      await queryInterface.addColumn("Whatsapps", "metaAccessToken", {
        type: DataTypes.TEXT,
        allowNull: true
      });
    }

    if (!(await columnExists(queryInterface, "Whatsapps", "metaBusinessAccountId"))) {
      await queryInterface.addColumn("Whatsapps", "metaBusinessAccountId", {
        type: DataTypes.STRING,
        allowNull: true
      });
    }

    if (!(await columnExists(queryInterface, "Whatsapps", "webhookVerifyToken"))) {
      await queryInterface.addColumn("Whatsapps", "webhookVerifyToken", {
        type: DataTypes.STRING,
        allowNull: true
      });
    }

    if (!(await columnExists(queryInterface, "Whatsapps", "lastWebhookReceivedAt"))) {
      await queryInterface.addColumn("Whatsapps", "lastWebhookReceivedAt", {
        type: DataTypes.DATE,
        allowNull: true
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    if (await columnExists(queryInterface, "Whatsapps", "apiType")) {
      await queryInterface.removeColumn("Whatsapps", "apiType");
    }
    if (await columnExists(queryInterface, "Whatsapps", "phoneNumberId")) {
      await queryInterface.removeColumn("Whatsapps", "phoneNumberId");
    }
    if (await columnExists(queryInterface, "Whatsapps", "metaAccessToken")) {
      await queryInterface.removeColumn("Whatsapps", "metaAccessToken");
    }
    if (await columnExists(queryInterface, "Whatsapps", "metaBusinessAccountId")) {
      await queryInterface.removeColumn("Whatsapps", "metaBusinessAccountId");
    }
    if (await columnExists(queryInterface, "Whatsapps", "webhookVerifyToken")) {
      await queryInterface.removeColumn("Whatsapps", "webhookVerifyToken");
    }
    if (await columnExists(queryInterface, "Whatsapps", "lastWebhookReceivedAt")) {
      await queryInterface.removeColumn("Whatsapps", "lastWebhookReceivedAt");
    }
  }
};
