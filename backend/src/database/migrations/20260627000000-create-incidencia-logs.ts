import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    let tableDescription: any;

    try {
      tableDescription = await queryInterface.describeTable("IncidenciaLogs");
    } catch (e) {
      tableDescription = null;
    }

    if (!tableDescription) {
      return queryInterface.createTable("IncidenciaLogs", {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        ticketId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: "Tickets", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        requestPayload: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        responsePayload: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        status: {
          type: DataTypes.STRING,
          allowNull: true
        },
        errorMessage: {
          type: DataTypes.TEXT,
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
        return queryInterface.addIndex("IncidenciaLogs", ["ticketId"], {
          name: "idx_incidencia_logs_ticket_id"
        });
      });
    }

    const columnsToAdd = [];

    if (!tableDescription.requestPayload) {
      columnsToAdd.push(
        queryInterface.addColumn("IncidenciaLogs", "requestPayload", {
          type: DataTypes.TEXT,
          allowNull: true
        })
      );
    }

    if (!tableDescription.responsePayload) {
      columnsToAdd.push(
        queryInterface.addColumn("IncidenciaLogs", "responsePayload", {
          type: DataTypes.TEXT,
          allowNull: true
        })
      );
    }

    if (!tableDescription.status) {
      columnsToAdd.push(
        queryInterface.addColumn("IncidenciaLogs", "status", {
          type: DataTypes.STRING,
          allowNull: true
        })
      );
    }

    if (!tableDescription.errorMessage) {
      columnsToAdd.push(
        queryInterface.addColumn("IncidenciaLogs", "errorMessage", {
          type: DataTypes.TEXT,
          allowNull: true
        })
      );
    }

    return Promise.all(columnsToAdd);
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("IncidenciaLogs");
  }
};
