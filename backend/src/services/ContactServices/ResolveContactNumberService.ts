import AppError from "../../errors/AppError";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import NormalizePhoneNumber from "../../helpers/NormalizePhoneNumber";
import { getWbot } from "../../libs/wbot";
import Country from "../../models/Country";
import Whatsapp from "../../models/Whatsapp";

interface Request {
  number: string;
  /** Conexión cuyo país se usa para completar números en formato nacional. */
  whatsappId?: number;
  /**
   * Consultar a WhatsApp para obtener el número canónico. Se puede apagar en
   * importaciones masivas o cuando el número ya viene de WhatsApp.
   */
  askWhatsapp?: boolean;
}

export interface ResolvedContactNumber {
  /** Número en dígitos, siempre con prefijo de país. */
  number: string;
  countryId?: number;
  /** Prefijo de país en dígitos, cuando se pudo determinar. */
  countryCode?: string;
  resolvedBy: "whatsapp" | "local";
}

const envDefaultCountryCode = (): string =>
  (process.env.DEFAULT_COUNTRY_CODE || "51").replace(/\D/g, "");

const findWhatsapp = async (whatsappId?: number): Promise<Whatsapp | null> => {
  try {
    if (whatsappId) {
      return await Whatsapp.findByPk(whatsappId, {
        attributes: ["id", "countryId", "apiType"],
        include: [{ model: Country, as: "country", attributes: ["code"] }]
      });
    }

    const defaultWhatsapp = await GetDefaultWhatsApp();

    if (!defaultWhatsapp) return null;

    return await Whatsapp.findByPk(defaultWhatsapp.id, {
      attributes: ["id", "countryId", "apiType"],
      include: [{ model: Country, as: "country", attributes: ["code"] }]
    });
  } catch (error) {
    return null;
  }
};

/**
 * Pide a WhatsApp el número canónico. Devuelve `null` si no hay sesión disponible o si
 * WhatsApp no reconoce el número.
 */
const askWhatsappForCanonicalNumber = async (
  candidate: string,
  whatsapp: Whatsapp | null
): Promise<string | null> => {
  // Solo whatsapp-web.js puede resolver el número canónico: la Cloud API de Meta no
  // expone nada equivalente a getNumberId.
  if (!whatsapp || (whatsapp.apiType || "whatsapp-web.js") !== "whatsapp-web.js") {
    return null;
  }

  try {
    const wbot = getWbot(whatsapp.id);
    const validNumber: any = await wbot.getNumberId(`${candidate}@c.us`);

    return validNumber?.user || null;
  } catch (error) {
    console.log(
      `[ResolveContactNumber] No se pudo consultar a WhatsApp por ${candidate}:`,
      error?.message || error
    );
    return null;
  }
};

/**
 * Devuelve el número de un contacto siempre con prefijo de país.
 *
 * Orden: se normaliza localmente (tabla `Countries` + país de la conexión) para armar un
 * candidato y, si la conexión es whatsapp-web.js, se confirma contra WhatsApp — que es la
 * fuente de verdad y corrige casos como el 9 de Argentina o el 1 de México. En conexiones
 * Meta, o cuando no hay sesión disponible, vale el resultado local. Si ninguna de las dos
 * resuelve, se lanza `ERR_CONTACT_NUMBER_WITHOUT_COUNTRY_CODE`.
 */
const ResolveContactNumberService = async ({
  number,
  whatsappId,
  askWhatsapp = true
}: Request): Promise<ResolvedContactNumber> => {
  const digits = String(number || "").replace(/\D/g, "");

  if (!digits) {
    throw new AppError("ERR_CONTACT_NUMBER_WITHOUT_COUNTRY_CODE");
  }

  const whatsapp = await findWhatsapp(whatsappId);

  const defaultCountryCode =
    whatsapp?.country?.code?.replace(/\D/g, "") || envDefaultCountryCode();

  const local = await NormalizePhoneNumber(digits, { defaultCountryCode });
  const candidate = local?.number || digits;

  if (askWhatsapp) {
    const canonical = await askWhatsappForCanonicalNumber(candidate, whatsapp);

    if (canonical) {
      const normalizedCanonical = await NormalizePhoneNumber(canonical);

      return {
        number: normalizedCanonical?.number || canonical,
        countryId: normalizedCanonical?.countryId || local?.countryId,
        countryCode: normalizedCanonical?.countryCode || local?.countryCode,
        resolvedBy: "whatsapp"
      };
    }
  }

  if (local) {
    return {
      number: local.number,
      countryId: local.countryId,
      countryCode: local.countryCode,
      resolvedBy: "local"
    };
  }

  throw new AppError("ERR_CONTACT_NUMBER_WITHOUT_COUNTRY_CODE");
};

export default ResolveContactNumberService;
