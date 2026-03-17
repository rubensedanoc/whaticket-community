import { QueryTypes } from "sequelize";
import { emitEvent } from "../../libs/emitEvent";
import { getIO } from "../../libs/socket";
import Contact from "../../models/Contact";
import Country from "../../models/Country";

interface ExtraInfo {
  name: string;
  value: string;
}

interface Request {
  name: string;
  number: string;
  isGroup: boolean;
  email?: string;
  profilePicUrl?: string;
  extraInfo?: ExtraInfo[];
  source?: "meta" | "wbot"; // Origen del contacto: meta = formato internacional, wbot = formato local
}

const CreateOrUpdateContactService = async ({
  name,
  number: rawNumber,
  profilePicUrl,
  isGroup,
  email = "",
  extraInfo = [],
  source
}: Request): Promise<Contact> => {
  // Normalizar número: remover todo excepto dígitos (elimina "+", espacios, guiones, etc.)
  const number = isGroup ? rawNumber : rawNumber.replace(/[^0-9]/g, "");

  console.log(`[CreateOrUpdateContactService] Número recibido: ${rawNumber}, normalizado: ${number}`);

  const io = getIO();
  let contact: Contact | null;

  contact = await Contact.findOne({ where: { number } });

  if (contact) {
    const updateData: Record<string, any> = {};

    if (profilePicUrl && contact.profilePicUrl !== profilePicUrl) {
      updateData.profilePicUrl = profilePicUrl;
    }

    // Solo detectar país si el contacto aún no tiene countryId
    if (!contact.countryId && !isGroup && source === "meta") {
      const countryId = await getCountryIdOfNumber(number);
      if (countryId) {
        updateData.countryId = countryId;
        console.log(`[CreateOrUpdateContactService] País detectado para contacto existente: ${countryId}`);
      }
    }

    if (Object.keys(updateData).length > 0) {
      await contact.update(updateData);

      emitEvent({
        event: {
          name: "contact",
          data: {
            action: "update",
            contact
          }
        }
      });

      // io.emit("contact", {
      //   action: "update",
      //   contact
      // });
    }
  } else {
    try {
      let countryId: number | null = null;

      // Solo detectar país si el contacto viene explícitamente de Meta (formato internacional E.164)
      // Si no se especifica source, no se detecta país (comportamiento por defecto para wbot)
      if (!isGroup && source === "meta") {
        countryId = await getCountryIdOfNumber(number);
        console.log(`[CreateOrUpdateContactService] País detectado para contacto Meta: ${countryId || 'ninguno'}`);
      }

      contact = await Contact.create({
        name,
        number,
        ...(profilePicUrl && { profilePicUrl }),
        email,
        isGroup,
        extraInfo,
        ...(countryId && { countryId })
      });

      emitEvent({
        event: {
          name: "contact",
          data: {
            action: "create",
            contact
          }
        }
      });

      // io.emit("contact", {
      //   action: "create",
      //   contact
      // });
    } catch (error) {
      console.log("---- Error al crear contacto", error);

      // Esperar 200 ms antes de reintentar
      await new Promise(resolve => setTimeout(resolve, 200));

      console.log(
        "---- Volvemos a verificar que el contacto no exista: ",
        number
      );

      // Verificar nuevamente que no exista ya
      contact = await Contact.findOne({ where: { number } });

      if (!contact) {
        console.log(
          "---- En la segunda verificación el contacto no existe, Reintentando otra vez crear el contacto: ",
          number
        );

        let countryId: number | null = null;

        // Solo detectar país si el contacto viene explícitamente de Meta
        if (!isGroup && source === "meta") {
          countryId = await getCountryIdOfNumber(number);
          console.log(`[CreateOrUpdateContactService] País detectado para contacto Meta (reintento): ${countryId || 'ninguno'}`);
        }

        contact = await Contact.create({
          name,
          number,
          ...(profilePicUrl && { profilePicUrl }),
          email,
          isGroup,
          extraInfo,
          ...(countryId && { countryId })
        });

        emitEvent({
          event: {
            name: "contact",
            data: {
              action: "create",
              contact
            }
          }
        });

        // io.emit("contact", {
        //   action: "create",
        //   contact
        // });
      } else {
        console.log(
          "---- En la segunda verificación, El contacto ya existe: ",
          number
        );
      }
    }
  }

  return contact;
};

/**
 * Detecta el país de un número telefónico basándose en el prefijo internacional.
 * Diseñado para trabajar con números en formato E.164 provenientes de Meta WhatsApp API.
 * 
 * @param number - Número telefónico ya normalizado (solo dígitos, sin símbolos)
 * @returns ID del país si se encuentra coincidencia, null si no se encuentra
 */
export const getCountryIdOfNumber = async (number: string): Promise<number | null> => {
  // Normalizar: remover cualquier símbolo que pudiera quedar (especialmente "+")
  const cleanNumber = number.replace(/[^0-9]/g, "");

  console.log(`[getCountryIdOfNumber] Detectando país para número: ${cleanNumber}`);

  // Obtener todos los países ordenados por longitud de código (más largo primero)
  // Esto asegura que se evalúen primero los códigos de 3 dígitos, luego 2, luego 1
  const allCountries: Country[] = await Country.sequelize.query(
    "SELECT * FROM Countries c ORDER BY LENGTH(c.code) DESC",
    { type: QueryTypes.SELECT }
  );

  console.log(`[getCountryIdOfNumber] Evaluando ${allCountries.length} países`);

  // Buscar coincidencia con el prefijo más largo primero
  for (const country of allCountries) {
    if (cleanNumber.startsWith(country.code)) {
      console.log(`[getCountryIdOfNumber] País detectado: ${country.name} (ID: ${country.id}, código: ${country.code})`);
      return country.id;
    }
  }

  console.warn(`[getCountryIdOfNumber] No se encontró país para el número: ${cleanNumber}`);
  return null;
};

export default CreateOrUpdateContactService;
