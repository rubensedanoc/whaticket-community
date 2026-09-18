/**
 * Auditoría de números de contacto — SOLO LECTURA, no modifica nada.
 *
 *   npm run contacts:audit
 *   npm run contacts:audit -- --csv > auditoria-contactos.csv
 *
 * La detección vive en `services/CronJobs/AuditContactNumbers` (compartida con el cron
 * semanal); acá solo se imprime el resultado.
 */
import "../database";
import AuditContactNumbers, {
  countMessages,
  countTickets
} from "../services/CronJobs/AuditContactNumbers";

const asCsv = process.argv.includes("--csv");

const run = async () => {
  const { totalContacts, withoutPrefix, duplicatePairs, onlyOrphans } =
    await AuditContactNumbers();

  if (asCsv) {
    console.log(
      "tipo,contactoId,nombre,numero,tickets,mensajes,duplicadoDeId,duplicadoDeNumero"
    );

    for (const contact of withoutPrefix) {
      const pair = duplicatePairs.find(p => p.orphan.id === contact.id);
      const tickets = await countTickets(contact.id);
      const messages = await countMessages(contact.id);

      console.log(
        [
          pair ? "duplicado" : "sin-prefijo",
          contact.id,
          `"${(contact.name || "").replace(/"/g, "'")}"`,
          contact.number,
          tickets,
          messages,
          pair?.canonical.id ?? "",
          pair?.canonical.number ?? ""
        ].join(",")
      );
    }

    return;
  }

  console.log("=".repeat(78));
  console.log(`Contactos individuales analizados: ${totalContacts}`);
  console.log(`Sin prefijo de país válido:        ${withoutPrefix.length}`);
  console.log(`Pares duplicados detectados:       ${duplicatePairs.length}`);
  console.log("=".repeat(78));

  if (duplicatePairs.length) {
    console.log("\n## Duplicados (mismo número con y sin prefijo)\n");

    for (const pair of duplicatePairs) {
      const orphanTickets = await countTickets(pair.orphan.id);
      const orphanMessages = await countMessages(pair.orphan.id);
      const canonicalTickets = await countTickets(pair.canonical.id);
      const canonicalMessages = await countMessages(pair.canonical.id);

      console.log(
        `#${pair.orphan.id} ${pair.orphan.number} (${pair.orphan.name}) -> ${orphanTickets} tickets, ${orphanMessages} msgs`
      );
      console.log(
        `#${pair.canonical.id} ${pair.canonical.number} (${pair.canonical.name}) -> ${canonicalTickets} tickets, ${canonicalMessages} msgs`
      );
      console.log(
        `   => fusionar ${pair.orphan.id} en ${pair.canonical.id}\n`
      );
    }
  }

  if (onlyOrphans.length) {
    console.log(
      "\n## Sin prefijo y sin contacto canónico (revisar uno por uno)\n"
    );

    onlyOrphans.forEach(contact => {
      console.log(
        `#${contact.id} ${contact.number} (${contact.name}) — creado ${new Date(
          contact.createdAt
        ).toISOString().slice(0, 10)}`
      );
    });
  }
};

run()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
