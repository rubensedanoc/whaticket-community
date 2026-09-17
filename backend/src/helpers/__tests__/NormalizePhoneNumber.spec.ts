jest.mock("../../models/Country", () => ({
  __esModule: true,
  default: {
    sequelize: {
      query: jest.fn()
    }
  }
}));

import Country from "../../models/Country";
import NormalizePhoneNumber, {
  loadKnownCountries
} from "../NormalizePhoneNumber";

const COUNTRIES = [
  { id: 1, name: "Argentina", code: "54" },
  { id: 2, name: "Bolivia", code: "591" },
  { id: 3, name: "Brazil", code: "55" },
  { id: 4, name: "Chile", code: "56" },
  { id: 5, name: "Colombia", code: "57" },
  { id: 6, name: "Dominican Republic", code: "1-809" },
  { id: 7, name: "Ecuador", code: "593" },
  { id: 8, name: "Mexico", code: "52" },
  { id: 9, name: "Peru", code: "51" },
  { id: 10, name: "United States", code: "1" }
];

const PERU = "51";

beforeEach(async () => {
  (Country as any).sequelize.query.mockResolvedValue(COUNTRIES);
  // fuerza recarga del cache entre tests
  await loadKnownCountries(true);
});

describe("NormalizePhoneNumber", () => {
  it("completa el prefijo de un móvil peruano en formato nacional", async () => {
    const result = await NormalizePhoneNumber("987654321", {
      defaultCountryCode: PERU
    });

    expect(result?.number).toBe("51987654321");
    expect(result?.source).toBe("completed-with-default-country");
    expect(result?.countryId).toBe(9);
  });

  it("deja intacto un número que ya trae prefijo", async () => {
    const result = await NormalizePhoneNumber("51987654321", {
      defaultCountryCode: PERU
    });

    expect(result?.number).toBe("51987654321");
    expect(result?.source).toBe("already-prefixed");
  });

  it("limpia separadores y el signo +", async () => {
    const result = await NormalizePhoneNumber("+51 987 654 321");

    expect(result?.number).toBe("51987654321");
  });

  it("descarta el 0 del troncal nacional", async () => {
    const result = await NormalizePhoneNumber("0987654321", {
      defaultCountryCode: PERU
    });

    expect(result?.number).toBe("51987654321");
  });

  it("descarta el 0 del troncal cuando viene después del prefijo de país", async () => {
    const result = await NormalizePhoneNumber("5930995650094");

    expect(result?.number).toBe("593995650094");
    expect(result?.countryId).toBe(7);
  });

  // Casos que antes resolvía a mano CreateContactService para 593 / 54 / 57
  it("descarta el 0 del troncal para Colombia", async () => {
    const result = await NormalizePhoneNumber("5703001234567");

    expect(result?.number).toBe("573001234567");
    expect(result?.countryId).toBe(5);
  });

  it("descarta el 0 del troncal para Argentina", async () => {
    const result = await NormalizePhoneNumber("5409111234567");

    expect(result?.number).toBe("549111234567");
    expect(result?.countryId).toBe(1);
  });

  it("no inventa un prefijo cuando el largo no corresponde al país por defecto", async () => {
    // 10 dígitos: es un móvil colombiano, no uno peruano. No debe volverse 513001234567.
    const result = await NormalizePhoneNumber("3001234567", {
      defaultCountryCode: PERU
    });

    expect(result).toBeNull();
  });

  it("devuelve null cuando no hay país por defecto y el número no trae prefijo", async () => {
    const result = await NormalizePhoneNumber("987654321");

    expect(result).toBeNull();
  });

  it("devuelve null para números demasiado cortos", async () => {
    const result = await NormalizePhoneNumber("12345", {
      defaultCountryCode: PERU
    });

    expect(result).toBeNull();
  });

  it("reconoce el 9 intermedio de los móviles argentinos", async () => {
    const result = await NormalizePhoneNumber("5491123456789");

    expect(result?.number).toBe("5491123456789");
    expect(result?.countryId).toBe(1);
  });

  it("prefiere el código más largo: 1809 (Rep. Dominicana) antes que 1 (EE.UU.)", async () => {
    const result = await NormalizePhoneNumber("18095551234");

    expect(result?.countryId).toBe(6);
  });

  it("reconoce un número de Estados Unidos", async () => {
    const result = await NormalizePhoneNumber("15551234567");

    expect(result?.countryId).toBe(10);
  });
});
