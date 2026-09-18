/**
 * Fusiona contactos duplicados por prefijo de país: mueve todo lo que cuelga del
 * contacto sin prefijo (tickets, mensajes, notificaciones, etc.) al contacto canónico
 * y elimina el duplicado.
 *
 *   npm run contacts:merge                      # DRY RUN, no toca nada
 *   npm run contacts:merge -- --apply           # aplica todos los pares detectados
 *   npm run contacts:merge -- --pair=1042:1310  # solo ese par
 *   npm run contacts:merge -- --pair=1042:1310 --apply
 *
 * Cada par se procesa en su propia transacción: si algo falla (por ejemplo una clave
 * única duplicada), se revierte ese par, se reporta y se continúa con los demás.
 */
import "../database";
import { QueryTypes } from "sequelize";
import Contact from "../models/Contact";
import sequelize from "../database";
import {
  hasValidCountryPrefix,
  loadKnownCountries
} from "../helpers/NormalizePhoneNumber";

const apply = process.argv.includes("--apply");
const pairArg = process.argv
  .find(arg => arg.startsWith("--pair="))
  ?.replace("--pair=", "");

interface ContactRow {
  id: number;
  name: string;
  number: string;
}

interface ContactReference {
  TABLE_NAME: string;
  COLUMN_NAME: string;
}

/**
 * Todas las columnas de la base que apuntan a Contacts. Se descubren en tiempo de
 * ejecución para que el script no quede desactualizado si se agregan tablas nuevas.
 */
const findContactReferences = async (): Promise<ContactReference[]> => {
  const rows: ContactReference[] = await sequelize.query(
    `SELECT TABLE_NAME, COLUMN_NAME
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND COLUMN_NAME IN ('contactId', 'participantContactId', 'groupContactId')
      ORDER BY TABLE_NAME`,
    { type: QueryTypes.SELECT }
  );

  return rows;
};

const findPairs = async (): Promise<{ orphan: ContactRow; canonical: ContactRow }[]> => {
  const countries = await loadKnownCountries(true);

  const contacts: ContactRow[] = await sequelize.query(
    "SELECT id, name, number FROM Contacts WHERE isGroup = 0 ORDER BY id",
    { type: QueryTypes.SELECT }
  );

  const byNumber = new Map<string, ContactRow>();
  contacts.forEach(contact => byNumber.set(String(contact.number), contact));

  const pairs: { orphan: ContactRow; canonical: ContactRow }[] = [];

  contacts.forEach(contact => {
    if (hasValidCountryPrefix(contact.number, countries)) return;

    countries.forEach(country => {
      const canonical = byNumber.get(`${country.code}${contact.number}`);

      if (canonical && canonical.id !== contact.id) {
        pairs.push({ orphan: contact, canonical });
      }
    });
  });

  return pairs;
};

const mergePair = async (
  orphan: ContactRow,
  canonical: ContactRow,
  references: ContactReference[]
): Promise<boolean> => {
  const transaction = await sequelize.transaction();

  try {
    for (const reference of references) {
      if (reference.TABLE_NAME === "Contacts") continue;

      const [, affected] = (await sequelize.query(
        `UPDATE \`${reference.TABLE_NAME}\`
            SET \`${reference.COLUMN_NAME}\` = :canonicalId
          WHERE \`${reference.COLUMN_NAME}\` = :orphanId`,
        {
          replacements: { canonicalId: canonical.id, orphanId: orphan.id },
          transaction
        }
      )) as any;

      if (affected) {
        console.log(
          `   ${reference.TABLE_NAME}.${reference.COLUMN_NAME}: ${affected} fila(s)`
        );
      }
    }

    await sequelize.query("DELETE FROM Contacts WHERE id = :orphanId", {
      replacements: { orphanId: orphan.id },
      transaction
    });

    if (apply) {
      await transaction.commit();
      console.log(`   ✅ fusionado`);
    } else {
      await transaction.rollback();
      console.log(`   (dry run — nada se guardó)`);
    }

    return true;
  } catch (error) {
    await transaction.rollback();
    console.log(`   ❌ requiere revisión manual: ${error?.message || error}`);
    return false;
  }
};

const run = async () => {
  const references = await findContactReferences();

  console.log(
    `Columnas que apuntan a Contacts: ${references
      .map(r => `${r.TABLE_NAME}.${r.COLUMN_NAME}`)
      .join(", ")}\n`
  );

  let pairs: { orphan: ContactRow; canonical: ContactRow }[];

  if (pairArg) {
    const [orphanId, canonicalId] = pairArg.split(":").map(Number);
    const orphan = await Contact.findByPk(orphanId);
    const canonical = await Contact.findByPk(canonicalId);

    if (!orphan || !canonical) {
      throw new Error(`No se encontró el par ${pairArg}`);
    }

    pairs = [
      {
        orphan: { id: orphan.id, name: orphan.name, number: orphan.number },
        canonical: {
          id: canonical.id,
          name: canonical.name,
          number: canonical.number
        }
      }
    ];
  } else {
    pairs = await findPairs();
  }

  if (!pairs.length) {
    console.log("No hay duplicados por prefijo de país.");
    return;
  }

  console.log(
    `${pairs.length} par(es) a fusionar ${apply ? "— MODO APLICAR" : "— DRY RUN"}\n`
  );

  let merged = 0;

  for (const pair of pairs) {
    console.log(
      `#${pair.orphan.id} ${pair.orphan.number} (${pair.orphan.name}) -> #${pair.canonical.id} ${pair.canonical.number} (${pair.canonical.name})`
    );

    const ok = await mergePair(pair.orphan, pair.canonical, references);
    if (ok) merged += 1;
  }

  console.log(
    `\n${merged}/${pairs.length} par(es) procesados sin error.${
      apply ? "" : " Ejecuta con --apply para guardar los cambios."
    }`
  );
};

run()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
