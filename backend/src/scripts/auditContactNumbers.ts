/**
 * Auditoría de números de contacto — SOLO LECTURA, no modifica nada.
 *
 *   npm run contacts:audit
 *   npm run contacts:audit -- --csv > auditoria-contactos.csv
 *
 * Reporta:
 *  1. Contactos cuyo número no tiene un prefijo de país válido para su largo.
 *  2. Pares de contactos duplicados: el mismo número guardado con y sin prefijo.
 */
import "../database";
import { QueryTypes } from "sequelize";
import Contact from "../models/Contact";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import {
  hasValidCountryPrefix,
  loadKnownCountries
} from "../helpers/NormalizePhoneNumber";

interface ContactRow {
  id: number;
  name: string;
  number: string;
  isGroup: boolean;
  createdAt: Date;
}

const asCsv = process.argv.includes("--csv");

const countTickets = async (contactId: number) =>
  Ticket.count({ where: { contactId } });

const countMessages = async (contactId: number) =>
  Message.count({
    include: [{ model: Ticket, as: "ticket", where: { contactId }, required: true }]
  });

const run = async () => {
  const countries = await loadKnownCountries(true);

  const contacts: ContactRow[] = await Contact.sequelize.query(
    "SELECT id, name, number, isGroup, createdAt FROM Contacts WHERE isGroup = 0 ORDER BY id",
    { type: QueryTypes.SELECT }
  );

  const withoutPrefix: ContactRow[] = [];
  const byNumber = new Map<string, ContactRow>();

  contacts.forEach(contact => {
    byNumber.set(String(contact.number), contact);

    if (!hasValidCountryPrefix(contact.number, countries)) {
      withoutPrefix.push(contact);
    }
  });

  // Pares duplicados: un contacto sin prefijo cuyo número, con algún prefijo conocido,
  // también existe como otro contacto.
  const duplicatePairs: {
    orphan: ContactRow;
    canonical: ContactRow;
    countryCode: string;
  }[] = [];

  withoutPrefix.forEach(orphan => {
    countries.forEach(country => {
      const canonical = byNumber.get(`${country.code}${orphan.number}`);

      if (canonical) {
        duplicatePairs.push({ orphan, canonical, countryCode: country.code });
      }
    });
  });

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
  console.log(`Contactos individuales analizados: ${contacts.length}`);
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

  const onlyOrphans = withoutPrefix.filter(
    contact => !duplicatePairs.some(pair => pair.orphan.id === contact.id)
  );

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
