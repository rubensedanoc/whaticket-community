import { QueryTypes } from "sequelize";
import Country from "../models/Country";

/**
 * Largos válidos del número NACIONAL (sin prefijo de país) para cada código de país.
 *
 * La tabla `Countries` solo guarda el prefijo, así que sin estos largos no se puede
 * distinguir "987654321" (móvil peruano sin prefijo) de un número que realmente empieza
 * con el código de otro país. De hecho `getCountryIdOfNumber` hoy clasifica 987654321
 * como Irán (código 98) justamente por eso.
 *
 * La clave es el código de país en dígitos (la tabla guarda "1-809", aquí es "1809").
 */
const NATIONAL_LENGTHS_BY_COUNTRY_CODE: Record<string, number[]> = {
  "1": [10], // Estados Unidos / Canadá
  "1809": [7], // República Dominicana
  "1829": [7],
  "1849": [7],
  "1876": [7], // Jamaica
  "51": [9], // Perú
  "52": [10], // México
  "53": [8], // Cuba
  "54": [10, 11], // Argentina (móviles con el 9 intermedio)
  "55": [10, 11], // Brasil
  "56": [9], // Chile
  "57": [10], // Colombia
  "58": [10], // Venezuela
  "502": [8], // Guatemala
  "503": [8], // El Salvador
  "504": [8], // Honduras
  "505": [8], // Nicaragua
  "506": [8], // Costa Rica
  "507": [8], // Panamá
  "591": [8], // Bolivia
  "593": [9], // Ecuador
  "595": [9], // Paraguay
  "598": [8] // Uruguay
};

// Para países cargados en `Countries` que no estén en el mapa de arriba.
const DEFAULT_NATIONAL_LENGTHS = [7, 8, 9, 10, 11];

const COUNTRIES_CACHE_TTL_IN_MS = 10 * 60 * 1000;

interface KnownCountry {
  id: number;
  name: string;
  code: string; // solo dígitos
  nationalLengths: number[];
}

let countriesCache: { countries: KnownCountry[]; loadedAt: number } | null =
  null;

export const loadKnownCountries = async (
  forceReload = false
): Promise<KnownCountry[]> => {
  const isFresh =
    countriesCache &&
    Date.now() - countriesCache.loadedAt < COUNTRIES_CACHE_TTL_IN_MS;

  if (isFresh && !forceReload) {
    return countriesCache.countries;
  }

  const rows: Country[] = await Country.sequelize.query(
    "SELECT id, name, code FROM Countries",
    { type: QueryTypes.SELECT }
  );

  const countries: KnownCountry[] = rows
    .map(row => {
      const code = (row.code || "").replace(/\D/g, "");

      return {
        id: row.id,
        name: row.name,
        code,
        nationalLengths:
          NATIONAL_LENGTHS_BY_COUNTRY_CODE[code] || DEFAULT_NATIONAL_LENGTHS
      };
    })
    .filter(country => country.code.length > 0)
    // el código más largo primero: "1809" debe ganarle a "1"
    .sort((a, b) => b.code.length - a.code.length);

  countriesCache = { countries, loadedAt: Date.now() };

  return countries;
};

export interface NormalizedPhoneNumber {
  /** Número en dígitos, siempre con prefijo de país. */
  number: string;
  countryId: number;
  countryName: string;
  countryCode: string;
  /**
   * - `already-prefixed`: el número ya venía con un prefijo de país válido.
   * - `completed-with-default-country`: se le agregó el prefijo del país por defecto.
   */
  source: "already-prefixed" | "completed-with-default-country";
}

/**
 * Devuelve el número normalizado (dígitos + prefijo de país) o `null` si no se puede
 * determinar con certeza a qué país pertenece.
 *
 * `defaultCountryCode` es el prefijo que se usa cuando el número viene en formato
 * nacional; normalmente el país de la conexión de WhatsApp por la que entra o sale.
 */
const NormalizePhoneNumber = async (
  rawNumber: string,
  options: { defaultCountryCode?: string } = {}
): Promise<NormalizedPhoneNumber | null> => {
  if (!rawNumber) return null;

  const countries = await loadKnownCountries();

  let digits = String(rawNumber).replace(/\D/g, "");

  // prefijo de marcación internacional (00 51 9…)
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (!digits) return null;

  // 1) ¿ya trae un prefijo de país válido para su largo?
  //
  // Si justo después del código de país viene un 0, no se acepta acá: en formato
  // internacional ningún número nacional empieza con 0, así que ese 0 es el troncal
  // nacional y lo resuelve el paso 1b. Sin esta salvedad, un argentino como
  // 54 0 9111234567 calzaría acá por largo (54 + 11 dígitos es un móvil válido) y el 0
  // nunca se descartaría.
  const prefixed = countries.find(
    country =>
      digits.startsWith(country.code) &&
      digits[country.code.length] !== "0" &&
      country.nationalLengths.includes(digits.length - country.code.length)
  );

  if (prefixed) {
    return {
      number: digits,
      countryId: prefixed.id,
      countryName: prefixed.name,
      countryCode: prefixed.code,
      source: "already-prefixed"
    };
  }

  // 1b) trae prefijo de país pero conserva el 0 del troncal nacional: 593 0 99565…
  const prefixedWithTrunkZero = countries.find(country => {
    if (!digits.startsWith(`${country.code}0`)) return false;

    const nationalLength = digits.length - country.code.length - 1;

    return country.nationalLengths.includes(nationalLength);
  });

  if (prefixedWithTrunkZero) {
    const { code } = prefixedWithTrunkZero;

    return {
      number: `${code}${digits.slice(code.length + 1)}`,
      countryId: prefixedWithTrunkZero.id,
      countryName: prefixedWithTrunkZero.name,
      countryCode: code,
      source: "already-prefixed"
    };
  }

  // 2) ¿es un número nacional del país por defecto?
  const defaultCountryCode = (options.defaultCountryCode || "").replace(
    /\D/g,
    ""
  );

  if (defaultCountryCode) {
    const defaultCountry = countries.find(
      country => country.code === defaultCountryCode
    );

    if (defaultCountry) {
      // se descarta el 0 del prefijo troncal nacional (0 987 654 321)
      const national = digits.replace(/^0+/, "");

      if (defaultCountry.nationalLengths.includes(national.length)) {
        return {
          number: `${defaultCountry.code}${national}`,
          countryId: defaultCountry.id,
          countryName: defaultCountry.name,
          countryCode: defaultCountry.code,
          source: "completed-with-default-country"
        };
      }
    }
  }

  return null;
};

/**
 * Versión sincrónica y sin base de datos, para scripts de auditoría que ya tienen la
 * lista de países cargada.
 */
export const hasValidCountryPrefix = (
  rawNumber: string,
  countries: KnownCountry[]
): KnownCountry | null => {
  const digits = String(rawNumber || "").replace(/\D/g, "");

  return (
    countries.find(
      country =>
        digits.startsWith(country.code) &&
        country.nationalLengths.includes(digits.length - country.code.length)
    ) || null
  );
};

export default NormalizePhoneNumber;
