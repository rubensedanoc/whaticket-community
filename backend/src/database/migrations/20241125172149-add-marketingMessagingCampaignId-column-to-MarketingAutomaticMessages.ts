import { DataTypes, QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    return queryInterface.sequelize.transaction(t => {
      return Promise.all([
        queryInterface.addColumn(
          "MarketingCampaignAutomaticMessages",
          "marketingMessagingCampaignId",
          {
            type: DataTypes.INTEGER,
            allowNull: true
          },
          { transaction: t }
        ),
        queryInterface.addConstraint(
          "MarketingCampaignAutomaticMessages",
          ["marketingMessagingCampaignId"],
          {
            type: "foreign key",
            name: "fk_mrkt_msg_campaign", // Nombre corto para evitar problemas con el límite de caracteres
            references: {
              table: "MarketingMessagingCampaigns",
              field: "id"
            },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
            transaction: t
          }
        )
      ]);
    });
  },

  down: async (queryInterface: QueryInterface) => {
    return queryInterface.sequelize.transaction(t => {
      return Promise.all([
        // Eliminar la restricción de la clave foránea
        queryInterface.removeConstraint(
          "MarketingCampaignAutomaticMessages",
          "fk_mrkt_msg_campaign", // El mismo nombre que has usado al crear la restricción,
          { transaction: t }
        ),
        // Eliminar la columna
        queryInterface.removeColumn(
          "MarketingCampaignAutomaticMessages",
          "marketingMessagingCampaignId",
          { transaction: t }
        )
      ]);
    });
  }
};
