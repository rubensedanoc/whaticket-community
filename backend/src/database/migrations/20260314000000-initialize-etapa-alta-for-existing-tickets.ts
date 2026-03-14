import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Actualizar todos los tickets de grupo abiertos/pendientes que están en etapa ALTA
    // pero no tienen fecha de asignación (tickets antiguos)
    // 
    // IMPORTANTE: Les asignamos fecha de hace 5 días para que puedan salir en 15 días más
    // (5 días ya pasados + 15 días = 20 días total)
    await queryInterface.sequelize.query(`
      UPDATE Tickets t
      INNER JOIN Contacts c ON t.contactId = c.id
      SET t.etapa_alta_assigned_at = DATE_SUB(NOW(), INTERVAL 5 DAY)
      WHERE t.isGroup = true
        AND t.status IN ('pending', 'open')
        AND c.traza_clientelicencia_currentetapaid = 5
        AND t.etapa_alta_assigned_at IS NULL
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    // Revertir: poner NULL a los tickets que se actualizaron
    await queryInterface.sequelize.query(`
      UPDATE Tickets t
      INNER JOIN Contacts c ON t.contactId = c.id
      SET t.etapa_alta_assigned_at = NULL
      WHERE t.isGroup = true
        AND t.status IN ('pending', 'open')
        AND c.traza_clientelicencia_currentetapaid = 5
    `);
  }
};
