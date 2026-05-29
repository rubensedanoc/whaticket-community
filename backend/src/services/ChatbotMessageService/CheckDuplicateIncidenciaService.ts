import { Op } from "sequelize";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import { DEFAULT_SUBDOMAIN } from "./CreateIncidenciaService";

interface CheckDuplicateParams {
  domain: string;
  pathJson: string;
  intervalMinutes?: number;
}

// Normaliza el pathJson eliminando timestamps para comparación
const normalizePathJson = (pathJson: string): string => {
  try {
    const parsed = JSON.parse(pathJson);
    if (Array.isArray(parsed)) {
      // Eliminar timestamps y mantener solo id y title
      const normalized = parsed.map(item => ({
        id: item.id,
        title: item.title
      }));
      return JSON.stringify(normalized);
    }
    return pathJson;
  } catch (error) {
    console.error(`[CheckDuplicateIncidenciaService] Error normalizando pathJson:`, error);
    return pathJson;
  }
};

interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingTicket?: Ticket;
}

const CheckDuplicateIncidenciaService = async (
  params: CheckDuplicateParams
): Promise<DuplicateCheckResult> => {
  const { domain, pathJson, intervalMinutes = 15 } = params;

  if (!domain || !pathJson) {
    console.log(`[CheckDuplicateIncidenciaService] Validación omitida: domain o pathJson vacío`);
    return { isDuplicate: false };
  }

  // Extraer subdominio para validar si es específico
  // Ej: "restaurantefestin.restaurant.pe" -> subdominio = "restaurantefestin"
  // Ej: "restaurant.pe" -> subdominio = "" (sin subdominio específico)
  let subdomain = "";
  try {
    const domainWithProtocol = domain.startsWith('http') ? domain : `https://${domain}`;
    const url = new URL(domainWithProtocol);
    const parts = url.hostname.split(".");
    if (parts.length > 2) {
      subdomain = parts.slice(0, -2).join(".");
    }
  } catch (error) {
    console.error(`[CheckDuplicateIncidenciaService] Error extrayendo subdominio:`, error);
  }

  // Omitir validación si no hay subdominio específico (evitar falsos positivos)
  if (!subdomain || subdomain === DEFAULT_SUBDOMAIN) {
    console.log(`[CheckDuplicateIncidenciaService] Validación omitida: sin subdominio específico (domain="${domain}", subdomain="${subdomain}")`);
    return { isDuplicate: false };
  }

  try {
    const now = new Date();
    const timeThreshold = new Date(now.getTime() - intervalMinutes * 60 * 1000);

    // Normalizar pathJson para comparación (sin timestamps)
    const normalizedPathJson = normalizePathJson(pathJson);

    console.log(`[CheckDuplicateIncidenciaService] Buscando duplicados para dominio: ${domain}, intervalo: ${intervalMinutes} min`);
    console.log(`[CheckDuplicateIncidenciaService] PathJson original: ${pathJson}`);
    console.log(`[CheckDuplicateIncidenciaService] PathJson normalizado: ${normalizedPathJson}`);
    console.log(`[CheckDuplicateIncidenciaService] Fecha límite: ${timeThreshold.toISOString()}`);

    // Buscar tickets con pathJson normalizado (solo pending/open)
    const candidateTickets = await Ticket.findAll({
      where: {
        incidenciaPathJson: { [Op.ne]: null },
        incidenciaExternalId: { [Op.ne]: null },
        status: { [Op.in]: ["pending", "open"] },
        createdAt: { [Op.gte]: timeThreshold }
      },
      include: [
        {
          model: Contact,
          as: "contact",
          where: { domain },
          required: true
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    // Filtrar por pathJson normalizado
    const existingTicket = candidateTickets.find(ticket => {
      if (!ticket.incidenciaPathJson) return false;
      const ticketNormalizedPath = normalizePathJson(ticket.incidenciaPathJson);
      return ticketNormalizedPath === normalizedPathJson;
    });

    if (existingTicket) {
      console.log(`[CheckDuplicateIncidenciaService] Duplicado encontrado: ticket ${existingTicket.id}, incidencia ${existingTicket.incidenciaExternalId}`);
      return {
        isDuplicate: true,
        existingTicket
      };
    }

    console.log(`[CheckDuplicateIncidenciaService] No se encontraron duplicados`);
    
    // Log adicional para debugging
    if (candidateTickets.length > 0) {
      console.log(`[CheckDuplicateIncidenciaService] Tickets candidatos encontrados (mismo dominio):`);
      candidateTickets.forEach(t => {
        const tNormalized = normalizePathJson(t.incidenciaPathJson || "");
        console.log(`  - Ticket ${t.id}: status="${t.status}", incidencia="${t.incidenciaExternalId}", pathNormalizado="${tNormalized}"`);
      });
    } else {
      console.log(`[CheckDuplicateIncidenciaService] No se encontraron tickets candidatos en el mismo dominio`);
    }

    return { isDuplicate: false };

  } catch (error) {
    console.error(`[CheckDuplicateIncidenciaService] Error validando duplicados:`, error);
    return { isDuplicate: false };
  }
};

export default CheckDuplicateIncidenciaService;
