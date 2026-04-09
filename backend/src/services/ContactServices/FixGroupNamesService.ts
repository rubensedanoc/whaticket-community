import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import { getWbot } from "../../libs/wbot";
import { Op } from "sequelize";

interface FixGroupNamesResult {
  total: number;
  fixed: number;
  errors: number;
  skipped: number;
  details: Array<{
    groupId: number;
    groupNumber: string;
    oldName: string;
    newName?: string;
    status: 'fixed' | 'no_ticket_found' | 'no_change_needed' | 'error' | 'wbot_not_found';
    error?: string;
  }>;
}

const FixGroupNamesService = async (): Promise<FixGroupNamesResult> => {
  const result: FixGroupNamesResult = {
    total: 0,
    fixed: 0,
    errors: 0,
    skipped: 0,
    details: []
  };

  console.log('[FixGroupNamesService] Iniciando corrección de nombres de grupos...');

  // Buscar grupos con nombres que empiezan con "Grupo "
  const groupsWithNumbers = await Contact.findAll({
    where: {
      isGroup: true,
      name: {
        [Op.like]: 'Grupo %'
      }
    }
  });

  result.total = groupsWithNumbers.length;
  console.log(`[FixGroupNamesService] Encontrados ${result.total} grupos con nombres genéricos`);

  for (const group of groupsWithNumbers) {
    try {
      console.log(`[FixGroupNamesService] Procesando grupo ${group.id} - ${group.name}`);

      // Buscar el ticket más reciente del grupo para obtener whatsappId
      const ticket = await Ticket.findOne({
        where: { contactId: group.id },
        order: [['updatedAt', 'DESC']]
      });

      if (!ticket?.whatsappId) {
        result.skipped++;
        result.details.push({
          groupId: group.id,
          groupNumber: group.number,
          oldName: group.name,
          status: 'no_ticket_found'
        });
        console.log(`[FixGroupNamesService] ⚠️ No se encontró ticket para grupo ${group.id}`);
        continue;
      }

      // Obtener wbot
      let wbot;
      try {
        wbot = getWbot(ticket.whatsappId);
      } catch (err) {
        result.skipped++;
        result.details.push({
          groupId: group.id,
          groupNumber: group.number,
          oldName: group.name,
          status: 'wbot_not_found',
          error: err.message
        });
        console.log(`[FixGroupNamesService] ⚠️ No se encontró wbot para whatsappId ${ticket.whatsappId}`);
        continue;
      }

      // Obtener chat real de WhatsApp
      const chat = await wbot.getChatById(`${group.number}@g.us`);

      if (chat?.name && chat.name !== group.name && !chat.name.startsWith('Grupo ')) {
        const oldName = group.name;
        // Actualizar nombre
        await group.update({ name: chat.name });

        result.fixed++;
        result.details.push({
          groupId: group.id,
          groupNumber: group.number,
          oldName,
          newName: chat.name,
          status: 'fixed'
        });
        console.log(`[FixGroupNamesService] ✅ Grupo ${group.id} actualizado: "${oldName}" -> "${chat.name}"`);
      } else {
        result.skipped++;
        result.details.push({
          groupId: group.id,
          groupNumber: group.number,
          oldName: group.name,
          status: 'no_change_needed'
        });
        console.log(`[FixGroupNamesService] ℹ️ Grupo ${group.id} no necesita cambios`);
      }
    } catch (error) {
      result.errors++;
      result.details.push({
        groupId: group.id,
        groupNumber: group.number,
        oldName: group.name,
        error: error.message,
        status: 'error'
      });
      console.log(`[FixGroupNamesService] ❌ Error procesando grupo ${group.id}:`, error.message);
    }
  }

  console.log(`[FixGroupNamesService] Finalizado - Total: ${result.total}, Corregidos: ${result.fixed}, Errores: ${result.errors}, Omitidos: ${result.skipped}`);

  return result;
};

export default FixGroupNamesService;
