import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      UPDATE Tickets t
      INNER JOIN Contacts c ON t.contactId = c.id
      SET t.etapa_alta_assigned_at = NOW()
      WHERE t.isGroup = true
        AND t.status IN ('pending', 'open')
        AND c.traza_clientelicencia_currentetapaid = 5
        AND t.etapa_alta_assigned_at IS NULL
    `);
  },

  down: (_queryInterface: QueryInterface): Promise<void> => {
    // Data backfill intentionally cannot be reversed safely: a blanket UPDATE
    // could erase legitimate Alta timestamps written after this migration.
    return Promise.resolve();
  }
};
