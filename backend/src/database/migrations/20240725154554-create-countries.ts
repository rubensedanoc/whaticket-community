import { DataTypes, QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("Countries", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
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

    return queryInterface.bulkInsert("Countries", [
      {
        name: "Argentina",
        code: "54",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Bolivia",
        code: "591",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Brazil",
        code: "55",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Chile",
        code: "56",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Colombia",
        code: "57",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Costa Rica",
        code: "506",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Cuba",
        code: "53",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Dominican Republic",
        code: "1-809",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Ecuador",
        code: "593",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "El Salvador",
        code: "503",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Guatemala",
        code: "502",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Honduras",
        code: "504",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Jamaica",
        code: "1-876",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Mexico",
        code: "52",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Nicaragua",
        code: "505",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Panama",
        code: "507",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Paraguay",
        code: "595",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Peru",
        code: "51",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "United States",
        code: "1",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Uruguay",
        code: "598",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Venezuela",
        code: "58",
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("Countries");
  }
};
