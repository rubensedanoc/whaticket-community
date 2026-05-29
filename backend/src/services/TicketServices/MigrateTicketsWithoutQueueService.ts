import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import Queue from "../../models/Queue";
import UpdateTicketService from "./UpdateTicketService";
import { logger } from "../../utils/logger";

interface MigrationResult {
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
  details: {
    ticketId: number;
    status: "migrated" | "skipped" | "error";
    queueId?: number;
    queueName?: string;
    error?: string;
  }[];
}

/**
 * Migra tickets sin departamento (queueId: null) asignándoles
 * automáticamente el primer departamento de su conexión WhatsApp.
 * 
 * Esto soluciona el problema de tickets creados desde Meta API
 * que no se les asignó queue automáticamente.
 */
const MigrateTicketsWithoutQueueService = async (): Promise<MigrationResult> => {
  logger.info("[MigrateTicketsWithoutQueue] Iniciando migración de tickets sin departamento");

  const result: MigrationResult = {
    total: 0,
    migrated: 0,
    skipped: 0,
    errors: 0,
    details: []
  };

  try {
    // Buscar todos los tickets sin queue
    const ticketsWithoutQueue = await Ticket.findAll({
      where: { queueId: null },
      include: [
        {
          model: Whatsapp,
          as: "whatsapp",
          include: [
            {
              model: Queue,
              as: "queues",
              attributes: ["id", "name"]
            }
          ]
        }
      ]
    });

    result.total = ticketsWithoutQueue.length;
    logger.info(`[MigrateTicketsWithoutQueue] Encontrados ${result.total} tickets sin departamento`);

    for (const ticket of ticketsWithoutQueue) {
      try {
        const queues = ticket.whatsapp?.queues || [];

        if (queues.length === 0) {
          // La conexión no tiene queues configuradas, saltar
          logger.warn(`[MigrateTicketsWithoutQueue] Ticket ${ticket.id}: Conexión sin departamentos configurados`);
          result.skipped++;
          result.details.push({
            ticketId: ticket.id,
            status: "skipped",
            error: "Conexión sin departamentos configurados"
          });
          continue;
        }

        // Asignar la primera queue disponible
        const queueToAssign = queues[0];

        await UpdateTicketService({
          ticketData: { queueId: queueToAssign.id },
          ticketId: ticket.id
        });

        logger.info(`[MigrateTicketsWithoutQueue] Ticket ${ticket.id}: Asignado a departamento "${queueToAssign.name}" (ID: ${queueToAssign.id})`);
        result.migrated++;
        result.details.push({
          ticketId: ticket.id,
          status: "migrated",
          queueId: queueToAssign.id,
          queueName: queueToAssign.name
        });

      } catch (err) {
        logger.error(`[MigrateTicketsWithoutQueue] Error migrando ticket ${ticket.id}:`, err);
        result.errors++;
        result.details.push({
          ticketId: ticket.id,
          status: "error",
          error: err.message
        });
      }
    }

    logger.info(`[MigrateTicketsWithoutQueue] Migración completada: ${result.migrated} migrados, ${result.skipped} omitidos, ${result.errors} errores`);

  } catch (err) {
    logger.error("[MigrateTicketsWithoutQueue] Error general en la migración:", err);
    throw err;
  }

  return result;
};

export default MigrateTicketsWithoutQueueService;
