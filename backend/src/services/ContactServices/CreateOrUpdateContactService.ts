import { emitEvent } from "../../libs/emitEvent";
import { getIO } from "../../libs/socket";
import Contact from "../../models/Contact";
import NormalizePhoneNumber from "../../helpers/NormalizePhoneNumber";

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
}

const CreateOrUpdateContactService = async ({
  name,
  number: rawNumber,
  profilePicUrl,
  isGroup,
  email = "",
  extraInfo = []
}: Request): Promise<Contact> => {
  const number = isGroup ? rawNumber : rawNumber.replace(/[^0-9]/g, "");

  // Los números que entran por aquí vienen de WhatsApp, así que ya son canónicos. No se
  // rechazan (eso haría perder mensajes entrantes), pero sí se deja rastro cuando alguno
  // llega sin un prefijo de país reconocible, para que la auditoría lo levante.
  if (!isGroup) {
    const normalized = await NormalizePhoneNumber(number);

    if (!normalized) {
      console.warn(
        `[CreateOrUpdateContact] Número sin prefijo de país reconocible: ${number}`
      );
    }
  }

  const io = getIO();
  let contact: Contact | null;

  contact = await Contact.findOne({ where: { number } });

  if (contact) {
    if (profilePicUrl && contact.profilePicUrl !== profilePicUrl) {
      contact.update({ profilePicUrl });

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
      let countryId = null;

      if (!isGroup) {
        countryId = await getCountryIdOfNumber(number);
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

        let countryId = null;

        if (!isGroup) {
          countryId = await getCountryIdOfNumber(number);
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
 * Devuelve el countryId del número, o undefined si no se puede determinar.
 *
 * Usa `NormalizePhoneNumber`, que valida prefijo + largo nacional. La versión anterior
 * solo comparaba `startsWith(country.code)` sobre el código crudo de la tabla, lo que
 * clasificaba mal dos casos: los códigos guardados con guion ("1-809" nunca calzaba) y
 * los números sin prefijo (987654321 quedaba como Irán por el "98").
 */
export const getCountryIdOfNumber = async (number: string) => {
  const normalized = await NormalizePhoneNumber(number);

  return normalized?.countryId;
};

export default CreateOrUpdateContactService;
