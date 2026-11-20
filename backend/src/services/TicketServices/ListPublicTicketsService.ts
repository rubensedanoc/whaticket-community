import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { Op, Order } from "sequelize";
import AppError from "../../errors/AppError";
import Category from "../../models/Category";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";

dayjs.extend(utc);
dayjs.extend(timezone);

export const PUBLIC_API_TIME_ZONE = "America/Lima";
export const DEFAULT_PAGE_SIZE = 200;
export const MAX_PAGE_SIZE = 200;
export const MAX_MESSAGES_PER_TICKET = 500;

/**
 * Identificadores que NO corresponden a un paso del chatbot, por lo que no
 * deben usarse para clasificar un mensaje como enviado por el bot.
 */
const NON_BOT_IDENTIFIERS = ["SKIP_UNREAD_RESET"];

export type MessageOrigin =
  | "CLIENTE"
  | "AGENTE"
  | "BOT"
  | "MIEMBRO_EMPRESA";

export interface ListPublicTicketsParams {
  year?: string | number;
  startDate?: string;
  endDate?: string;
  page?: string | number;
  pageSize?: string | number;
  dateField?: string;
  status?: string;
  queueId?: string | number;
  whatsappId?: string | number;
  ticketId?: string | number;
  excludeGroups?: string | boolean;
  includePrivate?: string | boolean;
  includeMessages?: string | boolean;
}

interface PublicApiResponse {
  success: true;
  filters: {
    year: number | null;
    startDate: string;
    endDate: string;
    dateField: "createdAt" | "updatedAt";
    timezone: string;
    status: string | null;
    queueId: number | null;
    whatsappId: number | null;
    excludeGroups: boolean;
    includePrivate: boolean;
    includeMessages: boolean;
  };
  pagination: {
    page: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  data: any[];
}

const parseBoolean = (
  value: string | boolean | undefined,
  defaultValue: boolean
): boolean => {
  if (value === undefined || value === null || value === "") return defaultValue;
  if (typeof value === "boolean") return value;
  return ["true", "1", "yes", "si", "sí"].includes(
    String(value).trim().toLowerCase()
  );
};

const parsePositiveInt = (
  value: string | number | undefined,
  fieldName: string
): number | null => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(
      `El parámetro "${fieldName}" debe ser un número entero positivo`,
      400
    );
  }
  return parsed;
};

/**
 * Parsea una fecha YYYY-MM-DD en zona horaria de Lima.
 * Se valida ANTES de llamar a dayjs.tz porque dayjs.tz lanza un RangeError
 * con cadenas inválidas en lugar de devolver una fecha inválida.
 */
const parseDateInTimeZone = (value: string, fieldName: string): dayjs.Dayjs => {
  const raw = String(value).trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new AppError(
      `El parámetro "${fieldName}" debe tener el formato YYYY-MM-DD`,
      400
    );
  }

  const parsed = dayjs.tz(raw, PUBLIC_API_TIME_ZONE);

  // dayjs desborda fechas inexistentes en silencio (2026-13-45 -> 2027-02-14),
  // así que se verifica que la fecha parseada sea exactamente la recibida.
  if (!parsed.isValid() || parsed.format("YYYY-MM-DD") !== raw) {
    throw new AppError(
      `El parámetro "${fieldName}" no es una fecha válida (YYYY-MM-DD)`,
      400
    );
  }

  return parsed;
};

/**
 * Resuelve el rango de fechas a consultar, siempre en zona horaria de Lima.
 * Prioridad: startDate/endDate explícitos > year > año en curso.
 */
const resolveDateRange = (params: ListPublicTicketsParams) => {
  const { year, startDate, endDate } = params;

  if (startDate || endDate) {
    const parsedStart = startDate
      ? parseDateInTimeZone(startDate, "startDate")
      : null;
    const parsedEnd = endDate ? parseDateInTimeZone(endDate, "endDate") : null;

    const from = parsedStart
      ? parsedStart.startOf("day")
      : (parsedEnd as dayjs.Dayjs).startOf("year");
    const to = parsedEnd
      ? parsedEnd.endOf("day")
      : (parsedStart as dayjs.Dayjs).endOf("year");

    if (to.isBefore(from)) {
      throw new AppError(
        '"endDate" no puede ser anterior a "startDate"',
        400
      );
    }

    return { from, to, resolvedYear: null as number | null };
  }

  const resolvedYear =
    year !== undefined && year !== null && String(year) !== ""
      ? Number(year)
      : dayjs().tz(PUBLIC_API_TIME_ZONE).year();

  if (
    !Number.isInteger(resolvedYear) ||
    resolvedYear < 2000 ||
    resolvedYear > 2100
  ) {
    throw new AppError(
      'El parámetro "year" debe ser un año válido de 4 dígitos (ej. 2026)',
      400
    );
  }

  const from = dayjs
    .tz(`${resolvedYear}-01-01`, PUBLIC_API_TIME_ZONE)
    .startOf("year");
  const to = dayjs
    .tz(`${resolvedYear}-01-01`, PUBLIC_API_TIME_ZONE)
    .endOf("year");

  return { from, to, resolvedYear };
};

const formatDate = (date: Date | string | null | undefined): string | null => {
  if (!date) return null;
  return dayjs(date).tz(PUBLIC_API_TIME_ZONE).format("YYYY-MM-DD HH:mm:ss");
};

const formatTimestamp = (timestamp: number | null): string | null => {
  if (!timestamp) return null;
  return dayjs
    .unix(timestamp)
    .tz(PUBLIC_API_TIME_ZONE)
    .format("YYYY-MM-DD HH:mm:ss");
};

/**
 * Determina el origen de un mensaje.
 * - fromMe === false  -> lo envió el cliente (entrante)
 * - fromMe === true   -> salió de nuestro lado; si tiene "identifier" de un
 *                        paso del chatbot lo envió el bot, si no, un agente.
 */
const resolveOrigin = (message: any): MessageOrigin => {
  if (!message.fromMe) {
    // En tickets de grupo un colaborador de la empresa puede escribir desde su
    // propio número: el mensaje es entrante, pero no proviene del cliente.
    return message.contact?.isCompanyMember ? "MIEMBRO_EMPRESA" : "CLIENTE";
  }

  const identifier = message.identifier;
  if (identifier && !NON_BOT_IDENTIFIERS.includes(identifier)) {
    return "BOT";
  }

  return "AGENTE";
};

const serializeMessage = (message: any) => {
  const origin = resolveOrigin(message);
  const esNuestro = origin !== "CLIENTE";

  // El contacto asociado solo identifica al autor en mensajes entrantes.
  // En los salientes la BD guarda el contacto del ticket, no quién escribió.
  const autorEsElContacto = !message.fromMe;

  return {
    id: message.id,
    origen: origin,
    esNuestro,
    lado: esNuestro ? "EMPRESA" : "CLIENTE",
    direccion: message.fromMe ? "SALIENTE" : "ENTRANTE",
    fromMe: !!message.fromMe,
    autor: {
      tipo: origin,
      nombre: autorEsElContacto
        ? message.contact?.name ?? null
        : origin === "BOT"
        ? "Chatbot"
        : null,
      contactId: autorEsElContacto ? message.contact?.id ?? null : null,
      esMiembroDeLaEmpresa: autorEsElContacto
        ? !!message.contact?.isCompanyMember
        : null
    },
    body: message.body,
    mediaType: message.mediaType ?? null,
    mediaUrl: message.mediaUrl ?? null,
    timestamp: message.timestamp ?? null,
    fecha: formatTimestamp(message.timestamp),
    createdAt: formatDate(message.createdAt),
    ack: message.ack ?? null,
    leido: !!message.read,
    esNotaInterna: !!message.isPrivate,
    eliminado: !!message.isDeleted,
    editado: !!message.isEdited,
    chatbotIdentifier:
      origin === "BOT" ? message.identifier ?? null : null,
    quotedMsgId: message.quotedMsgId ?? null
  };
};

const serializeTicket = (ticket: any, includeMessages: boolean) => {
  const messages: any[] = Array.isArray(ticket.messages) ? ticket.messages : [];
  const serializedMessages = messages.map(serializeMessage);

  const fromClient = serializedMessages.filter(m => m.origen === "CLIENTE");
  const fromAgent = serializedMessages.filter(m => m.origen === "AGENTE");
  const fromBot = serializedMessages.filter(m => m.origen === "BOT");
  const fromCompanyMember = serializedMessages.filter(
    m => m.origen === "MIEMBRO_EMPRESA"
  );

  const firstClientMessage = fromClient[0] ?? null;
  const firstOurMessage =
    serializedMessages.find(m => m.esNuestro) ?? null;

  return {
    id: ticket.id,
    status: ticket.status,
    esGrupo: !!ticket.isGroup,
    createdAt: formatDate(ticket.createdAt),
    updatedAt: formatDate(ticket.updatedAt),
    ultimoMensaje: ticket.lastMessage ?? null,
    ultimoMensajeFecha: formatTimestamp(ticket.lastMessageTimestamp),
    mensajesSinLeer: ticket.unreadMessages ?? 0,
    agenteTuvoContacto: !!ticket.userHadContact,
    transferido: !!ticket.transferred,
    contacto: ticket.contact
      ? {
          id: ticket.contact.id,
          nombre: ticket.contact.name,
          numero: ticket.contact.number,
          email: ticket.contact.email || null,
          esGrupo: !!ticket.contact.isGroup,
          esMiembroDeLaEmpresa: !!ticket.contact.isCompanyMember,
          dominio: ticket.contact.domain ?? null,
          trazaClientelicenciaId:
            ticket.contact.traza_clientelicencia_id ?? null
        }
      : null,
    conexion: ticket.whatsapp
      ? {
          id: ticket.whatsapp.id,
          nombre: ticket.whatsapp.name,
          numero: ticket.whatsapp.number
        }
      : null,
    departamento: ticket.queue
      ? { id: ticket.queue.id, nombre: ticket.queue.name }
      : null,
    agenteAsignado: ticket.user
      ? { id: ticket.user.id, nombre: ticket.user.name, email: ticket.user.email }
      : null,
    categorias: Array.isArray(ticket.categories)
      ? ticket.categories.map((c: any) => ({ id: c.id, nombre: c.name }))
      : [],
    chatbot: {
      identifier: ticket.chatbotMessageIdentifier ?? null,
      ultimoPaso: ticket.chatbotMessageLastStep ?? null
    },
    resumenRespuestas: {
      total: serializedMessages.length,
      delCliente: fromClient.length,
      deNuestroLado:
        fromAgent.length + fromBot.length + fromCompanyMember.length,
      deAgente: fromAgent.length,
      deBot: fromBot.length,
      deMiembroEmpresa: fromCompanyMember.length,
      primerMensajeClienteFecha: firstClientMessage?.fecha ?? null,
      primeraRespuestaNuestraFecha: firstOurMessage?.fecha ?? null,
      truncado: serializedMessages.length >= MAX_MESSAGES_PER_TICKET
    },
    ...(includeMessages ? { respuestas: serializedMessages } : {})
  };
};

const ListPublicTicketsService = async (
  params: ListPublicTicketsParams
): Promise<PublicApiResponse> => {
  const { from, to, resolvedYear } = resolveDateRange(params);

  const dateField =
    String(params.dateField ?? "createdAt") === "updatedAt"
      ? "updatedAt"
      : "createdAt";

  const page = parsePositiveInt(params.page, "page") ?? 1;
  const requestedPageSize =
    parsePositiveInt(params.pageSize, "pageSize") ?? DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE);
  const offset = (page - 1) * pageSize;

  const queueId = parsePositiveInt(params.queueId, "queueId");
  const whatsappId = parsePositiveInt(params.whatsappId, "whatsappId");
  const ticketId = parsePositiveInt(params.ticketId, "ticketId");

  const excludeGroups = parseBoolean(params.excludeGroups, false);
  const includePrivate = parseBoolean(params.includePrivate, false);
  const includeMessages = parseBoolean(params.includeMessages, true);

  const status = params.status ? String(params.status).trim() : null;

  const where: any = {
    [dateField]: {
      [Op.gte]: from.toDate(),
      [Op.lte]: to.toDate()
    },
    ...(status ? { status } : {}),
    ...(queueId ? { queueId } : {}),
    ...(whatsappId ? { whatsappId } : {}),
    ...(ticketId ? { id: ticketId } : {}),
    ...(excludeGroups ? { isGroup: false } : {})
  };

  // Paso 1: paginar solo los IDs para que el conteo no se vea afectado
  // por los JOINs de las relaciones incluidas.
  const { count: totalRecords, rows: pagedRows } =
    await Ticket.findAndCountAll({
      attributes: ["id"],
      where,
      order: [
        [dateField, "ASC"],
        ["id", "ASC"]
      ],
      limit: pageSize,
      offset,
      raw: true
    });

  const ticketIds = pagedRows.map((row: any) => row.id);

  let tickets: any[] = [];

  if (ticketIds.length) {
    const messageWhere = includePrivate
      ? undefined
      : { isPrivate: { [Op.or]: [null, false] } };

    const found = await Ticket.findAll({
      where: { id: { [Op.in]: ticketIds } },
      include: [
        {
          model: Contact,
          as: "contact",
          attributes: [
            "id",
            "name",
            "number",
            "email",
            "isGroup",
            "isCompanyMember",
            "domain",
            "traza_clientelicencia_id"
          ],
          required: false
        },
        {
          model: Whatsapp,
          as: "whatsapp",
          attributes: ["id", "name", "number"],
          required: false
        },
        {
          model: Queue,
          as: "queue",
          attributes: ["id", "name"],
          required: false
        },
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email"],
          required: false
        },
        {
          model: Category,
          as: "categories",
          attributes: ["id", "name"],
          through: { attributes: [] },
          required: false
        },
        ...(includeMessages
          ? [
              {
                model: Message,
                as: "messages",
                attributes: [
                  "id",
                  "fromMe",
                  "body",
                  "mediaType",
                  "mediaUrl",
                  "identifier",
                  "timestamp",
                  "ack",
                  "read",
                  "isPrivate",
                  "isDeleted",
                  "isEdited",
                  "quotedMsgId",
                  "createdAt",
                  "ticketId",
                  // Imprescindible: al combinar "separate" con "limit",
                  // sequelize arma un UNION de subconsultas y hace el JOIN a
                  // Contacts contra esa tabla derivada. Si contactId no está
                  // entre los atributos, la tabla derivada no lo tiene y MySQL
                  // responde "Unknown column 'Message.contactId' in 'ON'".
                  "contactId"
                ],
                ...(messageWhere ? { where: messageWhere } : {}),
                include: [
                  {
                    model: Contact,
                    as: "contact",
                    attributes: ["id", "name", "isCompanyMember"],
                    required: false
                  }
                ],
                required: false,
                separate: true,
                limit: MAX_MESSAGES_PER_TICKET,
                order: [
                  ["timestamp", "ASC"],
                  ["createdAt", "ASC"]
                ] as Order
              }
            ]
          : [])
      ]
    });

    const byId = new Map<number, any>();
    found.forEach(ticket => {
      byId.set(ticket.id, ticket.get({ plain: true }));
    });

    // Mantener el orden de la página calculada en el paso 1
    tickets = ticketIds
      .map(id => byId.get(id))
      .filter(Boolean)
      .map(ticket => serializeTicket(ticket, includeMessages));
  }

  const totalPages = pageSize > 0 ? Math.ceil(totalRecords / pageSize) : 0;

  return {
    success: true,
    filters: {
      year: resolvedYear,
      startDate: from.format("YYYY-MM-DD HH:mm:ssZ"),
      endDate: to.format("YYYY-MM-DD HH:mm:ssZ"),
      dateField,
      timezone: PUBLIC_API_TIME_ZONE,
      status,
      queueId,
      whatsappId,
      excludeGroups,
      includePrivate,
      includeMessages
    },
    pagination: {
      page,
      pageSize,
      totalRecords,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1
    },
    data: tickets
  };
};

export default ListPublicTicketsService;
