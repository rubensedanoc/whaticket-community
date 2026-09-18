/**
 * Auditoría de números de contacto — SOLO LECTURA, no modifica nada.
 *
 * Detecta:
 *  1. Contactos cuyo número no tiene un prefijo de país válido para su largo.
 *  2. Pares de contactos duplicados: el mismo número guardado con y sin prefijo.
 *
 * Lo usan el CLI (`npm run contacts:audit`) y el cron semanal de `server.ts`. No imprime
 * ni corta el proceso: devuelve el resultado y cada llamador decide qué hacer con él.
 */
import { QueryTypes } from "sequelize";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import {
  hasValidCountryPrefix,
  loadKnownCountries
} from "../../helpers/NormalizePhoneNumber";

export interface AuditedContact {
  id: number;
  name: string;
  number: string;
  isGroup: boolean;
  createdAt: Date;
}

export interface DuplicatePair {
  orphan: AuditedContact;
  canonical: AuditedContact;
  countryCode: string;
}

export interface ContactNumbersAudit {
  /** Contactos individuales analizados (excluye grupos). */
  totalContacts: number;
  /** Contactos sin prefijo de país válido para su largo. */
  withoutPrefix: AuditedContact[];
  /** Pares el mismo número con y sin prefijo: candidatos a fusionar. */
  duplicatePairs: DuplicatePair[];
  /** Sin prefijo y sin gemelo canónico: hay que revisarlos uno por uno. */
  onlyOrphans: AuditedContact[];
}

export const countTickets = async (contactId: number): Promise<number> =>
  Ticket.count({ where: { contactId } });

export const countMessages = async (contactId: number): Promise<number> =>
  Message.count({
    include: [
      { model: Ticket, as: "ticket", where: { contactId }, required: true }
    ]
  });

const AuditContactNumbers = async (): Promise<ContactNumbersAudit> => {
  const countries = await loadKnownCountries(true);

  const contacts: AuditedContact[] = await Contact.sequelize.query(
    "SELECT id, name, number, isGroup, createdAt FROM Contacts WHERE isGroup = 0 ORDER BY id",
    { type: QueryTypes.SELECT }
  );

  const withoutPrefix: AuditedContact[] = [];
  const byNumber = new Map<string, AuditedContact>();

  contacts.forEach(contact => {
    byNumber.set(String(contact.number), contact);

    if (!hasValidCountryPrefix(contact.number, countries)) {
      withoutPrefix.push(contact);
    }
  });

  // Pares duplicados: un contacto sin prefijo cuyo número, con algún prefijo conocido,
  // también existe como otro contacto.
  const duplicatePairs: DuplicatePair[] = [];

  withoutPrefix.forEach(orphan => {
    countries.forEach(country => {
      const canonical = byNumber.get(`${country.code}${orphan.number}`);

      if (canonical) {
        duplicatePairs.push({ orphan, canonical, countryCode: country.code });
      }
    });
  });

  const onlyOrphans = withoutPrefix.filter(
    contact => !duplicatePairs.some(pair => pair.orphan.id === contact.id)
  );

  return {
    totalContacts: contacts.length,
    withoutPrefix,
    duplicatePairs,
    onlyOrphans
  };
};

export default AuditContactNumbers;
