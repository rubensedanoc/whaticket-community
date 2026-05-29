import { Op } from "sequelize";
import Contact from "../../models/Contact";

interface ContactoBIResponse {
  data?: Array<{
    localbi_tipoatencion?: string; // "HIGH TOUCH" | "LOW TOUCH" | "TECH TOUCH"
    [key: string]: any;
  }>;
}


interface SyncResult {
  total: number;
  updated: number;
  failed: number;
  skipped: number;
  errors: Array<{ contactId: number; error: string }>;
}

interface SyncOptions {
  mode?: "all" | "missing" | "recent";
  limit?: number;
  batchSize?: number;
}

const SyncAttentionTypesService = async (
  options: SyncOptions = {}
): Promise<SyncResult> => {
  const {
    mode = "missing", // Por defecto solo sincronizar los que no tienen
    limit = 1000, // Máximo de contactos a procesar
    batchSize = 10, // Procesar de 10 en 10 para no saturar
  } = options;

  const result: SyncResult = {
    total: 0,
    updated: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // 1. Obtener contactos según el modo
    let whereClause: any = {
      number: { [Op.ne]: null }, // Solo contactos con número
    };

    if (mode === "missing") {
      whereClause.attentionType = null; // Solo los que no tienen tipo
    }

    const contacts = await Contact.findAll({
      where: whereClause,
      limit,
      attributes: ["id", "number", "attentionType"],
    });

    result.total = contacts.length;

    console.log(
      `📊 Sincronizando ${result.total} contactos (modo: ${mode})...`
    );

    // 2. Procesar en lotes
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(contacts.length / batchSize);

      console.log(`📦 Procesando lote ${batchNumber}/${totalBatches}...`);

      // Procesar cada contacto del lote
      const promises = batch.map(async (contact) => {
        try {
          // Si ya tiene attentionType y el modo es 'missing', skip
          if (mode === "missing" && contact.attentionType) {
            result.skipped++;
            return;
          }

          // Consultar microservicio
          const response = await fetch(
            "https://microservices.restaurant.pe/backendrestaurantpe/public/rest/common/contactobi/searchphone",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                telefono: contact.number,
              }),
            }
          );

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const data: ContactoBIResponse = await response.json();

          // Extraer y normalizar localbi_tipoatencion
          if (data.data && data.data.length > 0) {
            const rawCategoria = data.data[0].localbi_tipoatencion;

            if (rawCategoria) {
              // Normalizar: "HIGH TOUCH" -> "HIGH_TOUCH"
              const normalized = rawCategoria.toUpperCase().replace(/ /g, "_");

              // Validar que sea uno de los valores permitidos
              if (
                normalized === "HIGH_TOUCH" ||
                normalized === "LOW_TOUCH" ||
                normalized === "TECH_TOUCH"
              ) {
                // Actualizar en BD
                await contact.update({ attentionType: normalized });
                result.updated++;
                console.log(`✅ Contacto ${contact.id}: ${normalized}`);
              } else {
                result.skipped++;
                console.log(
                  `⚠️ Contacto ${contact.id}: Categoría no válida (${rawCategoria})`
                );
              }
            } else {
              result.skipped++;
            }
          } else {
            result.skipped++;
          }
        } catch (error: any) {
          result.failed++;
          result.errors.push({
            contactId: contact.id,
            error: error.message || "Unknown error",
          });
          console.error(`❌ Error contacto ${contact.id}:`, error.message);
        }
      });

      // Esperar que termine el lote
      await Promise.all(promises);

      // Pequeña pausa entre lotes para no saturar el microservicio
      if (i + batchSize < contacts.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log(`✨ Sincronización completada:`, {
      total: result.total,
      updated: result.updated,
      failed: result.failed,
      skipped: result.skipped,
    });

    return result;
  } catch (error) {
    console.error("💥 Error en sincronización:", error);
    throw error;
  }
};

export default SyncAttentionTypesService;
