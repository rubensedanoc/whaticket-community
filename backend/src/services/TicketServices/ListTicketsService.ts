import { endOfDay, parseISO, startOfDay } from "date-fns";
import {
  Filterable,
  Includeable,
  Op,
  Sequelize,
  col,
  fn,
  where
} from "sequelize";
import Category from "../../models/Category";
import Contact from "../../models/Contact";
import MarketingCampaign from "../../models/MarketingCampaign";
import Queue from "../../models/Queue";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";
import ContactClientelicencias from "../../models/ContactClientelicencias";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  status?: string;
  showAll?: string;
  userId: string;
  whatsappIds: Array<number>;
  queueIds: Array<number>;
  ticketUsersIds: Array<number>;
  accountManagerIds?: Array<number>;
  marketingCampaignIds: Array<number>;
  typeIds: Array<string>;
  showOnlyMyGroups: boolean;
  categoryId?: number;
  userWhatsappsId?: number[];
  showOnlyWaitingTickets?: boolean;
  clientelicenciaEtapaIds?: number[];
  viewSource?: string;
  ticketsType?: string;
  profile?: string;
  waitingTimeRanges?: string[]; // ✅ Nuevo parámetro
}

interface Response {
  tickets: any[];
  count: number;
  hasMore: boolean;
  whereCondition: Filterable["where"];
  includeCondition: Includeable[];
}

// Función para construir la condición where principal
const buildWhereCondition = async ({
  userId,
  typeIds,
  queueIds,
  ticketUsersIds,
  accountManagerIds,
  marketingCampaignIds,
  whatsappIds,
  categoryId,
  showAll,
  showOnlyMyGroups,
  searchParam,
  status,
  userWhatsappsId,
  showOnlyWaitingTickets,
  clientelicenciaEtapaIds,
  viewSource,
  ticketsType,
  profile,
  waitingTimeRanges
}: Request): Promise<Filterable["where"]> => {
  
  // Inicio de buildWhereCondition
  const logPrefix = `[ListTickets:buildWhere]`;
  
  // ============================================================
  // BLOQUE PREPARADO PARA LÓGICA ESPECÍFICA SEGÚN VIEWSOURCE
  // ============================================================
  // FILTRADO POR DEPARTAMENTO EN VISTA "POR CLIENTES"
  // ============================================================
  
  let baseCondition: Filterable["where"] = {};

  // Obtener IDs de departamentos del usuario UNA SOLA VEZ (evitar consultas duplicadas)
  let userQueueIds: number[] = [];
  
  // if (viewSource === "grouped" && userId && profile !== "admin") {
  //   const startTime = Date.now();
  //   console.log(`${logPrefix} 🔄 Obteniendo departamentos del usuario ${userId}...`);
    
  //   const user = await User.findByPk(userId, {
  //     include: [{
  //       model: Queue,
  //       as: "queues",
  //       attributes: ["id"]
  //     }]
  //   });
    
  //   if (user && user.queues && user.queues.length > 0) {
  //     userQueueIds = user.queues.map((q: any) => q.id);
  //   }
    
  //   const elapsed = Date.now() - startTime;
  //   console.log(`${logPrefix} ✅ Departamentos obtenidos en ${elapsed}ms:`, userQueueIds);
  // }

  // FILTRAR COLUMNA "MI DEPARTAMENTO" - Incluir solo tickets de mis departamentos
  // ✅ OPTIMIZACIÓN: Filtrar directamente por queueId del ticket
  // if (viewSource === "grouped" && ticketsType === "my-department" && userQueueIds.length > 0) {
  //   console.log(`${logPrefix} 🎯 Aplicando filtro MI DEPARTAMENTO: tickets con queueId en`, userQueueIds);
  //   baseCondition.queueId = {
  //     [Op.in]: userQueueIds
  //   };
    
  //   // ✅ FIX: "Mi Departamento" solo debe mostrar tickets abiertos y pendientes, NO cerrados
  //   if (!status) {
  //     console.log(`${logPrefix} 🎯 MI DEPARTAMENTO: Filtrando solo open y pending (excluyendo closed)`);
  //     baseCondition.status = {
  //       [Op.in]: ["open", "pending"]
  //     };
  //   }
  // }

  // FILTRAR COLUMNA "EN PROCESO" - Excluir tickets de mis departamentos
  // COMENTADO TEMPORALMENTE - Vista Por Clientes deshabilitada
  // if (viewSource === "grouped" && ticketsType === "in-progress" && userQueueIds.length > 0) {
  //   baseCondition.queueId = {
  //     [Op.notIn]: userQueueIds
  //   };
  // }

  // FILTRAR COLUMNA "CERRADOS" - Incluir solo tickets de mis departamentos
  // COMENTADO TEMPORALMENTE - Vista Por Clientes deshabilitada
  // if (viewSource === "grouped" && status === "closed" && userQueueIds.length > 0) {
  //   baseCondition.queueId = {
  //     [Op.in]: userQueueIds
  //   };
  // }

  // Columnas "Sin respuesta" NO se filtran por departamento (acceso global)
  // ============================================================

  // si tengo status, entonces filtro por status
  if (status) {
    baseCondition = { ...baseCondition, status };
    
    // Si es status "closed", filtramos solo los tickets cerrados del mes actual
    if (status === "closed") {
      const now = new Date();
      const firstDayOfMonth = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      const lastDayOfMonth = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      
      baseCondition = {
        ...baseCondition,
        updatedAt: {
          [Op.gte]: firstDayOfMonth,
          [Op.lte]: lastDayOfMonth
        }
      };
    }
  }

  //  si tengo searchParam, entonces tmb busco por nombre o número
  if (searchParam) {
    const sanitizedSearchParam = searchParam.toLowerCase().trim();
    baseCondition = {
      ...baseCondition,
      [Op.and]: [
        {
          [Op.or]: [
            {
              "$contact.name$": where(
                fn("LOWER", col("contact.name")),
                "LIKE",
                `%${sanitizedSearchParam}%`
              )
            },
            { "$contact.number$": { [Op.like]: `%${sanitizedSearchParam}%` } }
          ]
        }
      ]
    };
  }

  // si tengo typeIs ("group" o "individual" o los 2)
  // entonces uso el isGroup del ticket para filtrar
  if (typeIds?.length) {
    baseCondition = {
      ...baseCondition,
      isGroup: { [Op.or]: typeIds.map(typeId => typeId === "group") }
    };
  }

  // ============================================================
  // LÓGICA ESPECIAL PARA GRUPOS EN VISTA GENERAL
  // ============================================================
  // Para grupos, la distribución entre columnas se basa en PARTICIPACIÓN:
  // - "Sin Atención" (pending) = Grupos OPEN donde el usuario NO participa
  // - "En Proceso" (open) = Grupos OPEN donde el usuario SÍ participa
  // ============================================================
  const isOnlyGroups = typeIds?.length === 1 && typeIds[0] === "group";
  
  if (isOnlyGroups && (status === "pending" || status === "open")) {
    // Para grupos, siempre buscamos status "open" (los grupos casi nunca están en pending)
    baseCondition = { ...baseCondition, status: "open" };
    
    if (status === "pending") {
      // "Sin Atención": Grupos donde el usuario NO participa
      (baseCondition as any)[Op.and] = [
        ...((baseCondition as any)[Op.and] || []),
        Sequelize.literal(
          `NOT EXISTS (
            SELECT 1 FROM \`TicketParticipantUsers\` 
            WHERE \`TicketParticipantUsers\`.\`ticketId\` = \`Ticket\`.\`id\` 
            AND \`TicketParticipantUsers\`.\`userId\` = ${userId}
          )`
        )
      ];
    } else if (status === "open") {
      // "En Proceso": Grupos donde el usuario SÍ participa
      (baseCondition as any)[Op.and] = [
        ...((baseCondition as any)[Op.and] || []),
        Sequelize.literal(
          `EXISTS (
            SELECT 1 FROM \`TicketParticipantUsers\` 
            WHERE \`TicketParticipantUsers\`.\`ticketId\` = \`Ticket\`.\`id\` 
            AND \`TicketParticipantUsers\`.\`userId\` = ${userId}
          )`
        )
      ];
    }
  }

  // ✅ Filtro por rango de tiempo de espera (Backend)
  if (waitingTimeRanges && waitingTimeRanges.length > 0) {
    const timeConditions: any[] = [];
    const nowInSeconds = Math.floor(Date.now() / 1000);

    waitingTimeRanges.forEach((range) => {
      // Formato esperado: "0-30", "30-60", "4320+"
      if (range.includes("+")) {
        // Caso "mayor que" (ej: 4320+)
        const minMinutes = parseInt(range.replace("+", ""), 10);
        if (!isNaN(minMinutes)) {
          // Si lleva esperando X minutos, su timestamp es MENOR que (ahora - X)
          const maxTimestamp = nowInSeconds - (minMinutes * 60);
          timeConditions.push({
            beenWaitingSinceTimestamp: {
              [Op.lte]: maxTimestamp,
              [Op.not]: null
            }
          });
        }
      } else {
        // Caso rango (ej: 0-30)
        const parts = range.split("-");
        if (parts.length === 2) {
          const minMinutes = parseInt(parts[0], 10);
          const maxMinutes = parseInt(parts[1], 10);
          
          if (!isNaN(minMinutes) && !isNaN(maxMinutes)) {
            // Rango de tiempo de espera: [min, max)
            // Timestamp debe estar entre (ahora - max) y (ahora - min)
            const minTimestamp = nowInSeconds - (maxMinutes * 60); // Límite inferior de timestamp (más antiguo)
            const maxTimestamp = nowInSeconds - (minMinutes * 60); // Límite superior de timestamp (más reciente)
            
            timeConditions.push({
              beenWaitingSinceTimestamp: {
                [Op.gte]: minTimestamp,
                [Op.lt]: maxTimestamp,
                [Op.not]: null
              }
            });
          }
        }
      }
    });

    if (timeConditions.length > 0) {
      baseCondition = {
        ...baseCondition,
        [Op.or]: timeConditions
      };
    }
  }

  // ✅ Filtro "Solo sin respuesta" (manual, sin separación automática)
  // Cuando el filtro está ACTIVADO: Solo muestra tickets donde el cliente escribió último
  // Cuando el filtro está DESACTIVADO: Muestra todos los tickets (sin filtrar por tiempo de espera)
  if (showOnlyWaitingTickets) {
    baseCondition = {
      ...baseCondition,
      beenWaitingSinceTimestamp: {
        [Op.not]: null
      }
    };
  }
  // NO filtrar automáticamente por beenWaitingSinceTimestamp cuando el filtro está desactivado

  if (clientelicenciaEtapaIds.length) {
    baseCondition = {
      ...baseCondition,
      "$contact.traza_clientelicencia_currentetapaid$": {
        [Op.or]: clientelicenciaEtapaIds.includes(null)
          ? [clientelicenciaEtapaIds.filter(id => id !== null), null]
          : [clientelicenciaEtapaIds]
      }
    };
  }

  // Forzar privacidad si es open/pending y no es admin
  const forcePrivacy = (status === "open" || status === "pending") && profile !== "admin";

  // si solo estoy viendo mis individuales abiertos o pendientes, entonces muestro los tickets que tengan mi userId o en los que este ayudando
  // si solo estoy viendo mis individuales abiertos o pendientes, o si SE FUERZA PRIVACIDAD
  if (
    (showAll !== "true" || forcePrivacy) &&
    (typeIds[0] === "individual" || forcePrivacy) &&
    (status === "open" || status === "pending")
  ) {
    baseCondition = {
      ...baseCondition,
      [Op.and]: [
        ...(baseCondition[Op.and] || []),
        {
          [Op.or]: [
            { userId },
            {
              id: {
                [Op.in]: Sequelize.literal(
                  `(SELECT \`ticketId\` FROM \`TicketHelpUsers\` WHERE \`userId\` = ${userId})`
                )
              }
            },
            {
              id: {
                [Op.in]: Sequelize.literal(
                  `(SELECT \`ticketId\` FROM \`TicketParticipantUsers\` WHERE \`userId\` = ${userId})`
                )
              }
            },
            // ✅ FIX: Mostrar GRUPOS de mis conexiones (aunque no participe)
            {
              [Op.and]: [
                { isGroup: true },
                { whatsappId: { [Op.in]: userWhatsappsId } }
              ]
            },
            // Para pending, tambien incluir tickets sin asignar (userId: null)
            ...(status === "pending" ? [{ userId: null }] : []),
            ...(searchParam && userWhatsappsId.length > 0
              ? [
                  {
                    whatsappId: {
                      [Op.in]: userWhatsappsId
                    }
                  }
                ]
              : [])
          ]
        }
      ]
    };
  }

  // Si no estoy viendo solo mis grupos o solo mis individuales abiertos O si no hay searchparam
  // voy a permitir filtrar por departamento o conexión
  if (
    !(
      typeIds.length === 1 &&
      ((showAll !== "true" &&
        typeIds[0] === "individual" &&
        status === "open") ||
        (showOnlyMyGroups && typeIds[0] === "group"))
    )
  ) {
    if (queueIds?.length) {
      const queueFilter = queueIds.includes(null)
        ? { [Op.or]: [queueIds.filter(id => id !== null), null] }
        : { [Op.in]: queueIds };

      baseCondition = {
        ...baseCondition,
        [Op.and]: [
          ...(baseCondition[Op.and] || []),
          {
            [Op.or]: [
              { queueId: queueFilter },
              // ✅ FIX: Permitir ver tickets asignados a mí (aunque no esté en la cola)
              { userId },
              // ✅ FIX: Permitir ver GRUPOS de mis conexiones (aunque no esté en la cola)
              {
                [Op.and]: [
                  { isGroup: true },
                  { whatsappId: { [Op.in]: userWhatsappsId } }
                ]
              }
            ]
          }
        ]
      };
    }
    // ✅ Filtro combinado: Usuarios + Ejecutivo de Cuenta
    // Cuando AMBOS filtros están activos → OR (mostrar tickets del usuario O donde es ejecutivo)
    // Cuando solo uno está activo → se aplica individualmente
    const hasUserFilter = ticketUsersIds?.length && status === "open";
    const hasAccountManagerFilter = accountManagerIds?.length;

    if (hasUserFilter && hasAccountManagerFilter) {
      // ✅ MODO OR: Mostrar tickets donde userId coincida O accountManagerId coincida
      const userConditions: any[] = [
        { userId: { [Op.in]: ticketUsersIds } },
        {
          id: {
            [Op.in]: Sequelize.literal(
              `(SELECT \`ticketId\` FROM \`TicketHelpUsers\` WHERE \`userId\` IN (${ticketUsersIds.join(",")}))`
            )
          }
        },
        Sequelize.literal(
          `EXISTS (
            SELECT 1
            FROM \`TicketParticipantUsers\`
            WHERE \`TicketParticipantUsers\`.\`ticketId\`  = \`Ticket\`.\`id\`
            AND \`TicketParticipantUsers\`.\`userId\` IN (${ticketUsersIds.join(",")})
          )`
        ),
        {
          [Op.and]: [
            { isGroup: true },
            { whatsappId: { [Op.in]: userWhatsappsId } }
          ]
        }
      ];

      const accountManagerConditions: any[] = [];
      const hasNull = accountManagerIds.includes(null as any);
      const nonNullIds = accountManagerIds.filter((id: any) => id !== null);
      if (nonNullIds.length) {
        accountManagerConditions.push({ accountManagerId: { [Op.in]: nonNullIds } });
      }
      if (hasNull) {
        accountManagerConditions.push({ accountManagerId: null });
      }

      baseCondition = {
        ...baseCondition,
        [Op.and]: [
          ...(baseCondition[Op.and] || []),
          {
            [Op.or]: [
              ...userConditions,
              ...accountManagerConditions
            ]
          }
        ]
      };
    } else if (hasUserFilter) {
      // Solo filtro de usuarios activo
      baseCondition = {
        ...baseCondition,
        [Op.and]: [
          ...(baseCondition[Op.and] || []),
          {
            [Op.or]: [
              {
                userId: {
                  [Op.in]: ticketUsersIds
                }
              },
              {
                id: {
                  [Op.in]: Sequelize.literal(
                    `(SELECT \`ticketId\` FROM \`TicketHelpUsers\` WHERE \`userId\` IN (${ticketUsersIds.join(",")}))`
                  )
                }
              },
              Sequelize.literal(
                `EXISTS (
                  SELECT 1
                  FROM \`TicketParticipantUsers\`
                  WHERE \`TicketParticipantUsers\`.\`ticketId\`  = \`Ticket\`.\`id\`
                  AND \`TicketParticipantUsers\`.\`userId\` IN (${ticketUsersIds.join(",")})
                )`
              ),
              {
                [Op.and]: [
                  { isGroup: true },
                  { whatsappId: { [Op.in]: userWhatsappsId } }
                ]
              }
            ]
          }
        ]
      };
    } else if (hasAccountManagerFilter) {
      // Solo filtro de ejecutivo activo
      const hasNull = accountManagerIds.includes(null as any);
      const nonNullIds = accountManagerIds.filter((id: any) => id !== null);
      if (hasNull) {
        baseCondition = {
          ...baseCondition,
          [Op.and]: [
            ...(baseCondition[Op.and] || []),
            {
              [Op.or]: [
                ...(nonNullIds.length ? [{ accountManagerId: { [Op.in]: nonNullIds } }] : []),
                { accountManagerId: null }
              ]
            }
          ]
        };
      } else {
        baseCondition = {
          ...baseCondition,
          accountManagerId: {
            [Op.in]: accountManagerIds
          }
        };
      }
    }
    if (marketingCampaignIds?.length) {
      baseCondition = {
        ...baseCondition,
        marketingCampaignId: {
          [Op.or]: marketingCampaignIds.includes(null)
            ? [marketingCampaignIds.filter(id => id !== null), null]
            : [marketingCampaignIds]
        }
      };
    }
    if (whatsappIds?.length) {
      baseCondition = {
        ...baseCondition,
        [Op.and]: [
          ...(baseCondition[Op.and] || []),
          {
            [Op.or]: [
              { whatsappId: { [Op.in]: whatsappIds } },
              { userId } // ✅ FIX: Mostrar siempre tickets asignados al usuario actual
            ]
          }
        ]
      };
    }
  }

  // si tengo categoryId = 0, entonces busco solo los tickets que no
  // tienen ninguna categoria asignada
  if (categoryId === 0) {
    baseCondition = {
      ...baseCondition,
      [Op.and]: [
        ...(baseCondition[Op.and] || []),
        Sequelize.literal(
          `NOT EXISTS (
            SELECT 1
            FROM \`TicketCategories\`
            WHERE \`TicketCategories\`.\`ticketId\`  = \`Ticket\`.\`id\`
          )`
        )
      ]
    };
  }

  return baseCondition;
};

// Función para construir la condición include
const buildIncludeCondition = ({
  searchParam,
  categoryId,
  userId,
  showOnlyMyGroups,
  typeIds
}: Request): Includeable[] => {
  const includeCondition: Includeable[] = [
    {
      model: Contact,
      as: "contact",
      attributes: [
        "id",
        "name",
        "number",
        "domain",
        "profilePicUrl",
        "countryId",
        "isCompanyMember",
        "isExclusive",
        "traza_clientelicencia_id",
        "traza_clientelicencia_currentetapaid",
        "attentionType"
      ],

      include: [
        {
          model: ContactClientelicencias,
          as: "contactClientelicencias",
          required: false,
        }
      ],
      required: true,
    },
    {
      model: Queue,
      as: "queue",
      attributes: ["id", "name", "color"]
    },
    {
      model: Whatsapp,
      as: "whatsapp",
      attributes: ["name"],
      include: [
        {
          model: User,
          attributes: ["id"],
          as: "userWhatsapps",
          required: false
        }
      ]
    },
    {
      model: Category,
      as: "categories",
      attributes: ["id", "name", "color"],
      ...(categoryId > 0 && {
        where: {
          id: categoryId
        },
        required: true
      })
    },
    {
      model: User,
      as: "user",
      attributes: ["id", "name"]
    },
    {
      model: User,
      as: "accountManager",
      attributes: ["id", "name"],
      required: false
    },
    {
      model: User,
      as: "helpUsers",
      attributes: ["id", "name"],
      required: false
    },
    {
      model: User,
      as: "participantUsers",
      attributes: ["id", "name"],
      ...(showOnlyMyGroups && typeIds.length === 1 && typeIds.includes("group")
        ? {
            where: {
              id: +userId
            },
            required: true
          }
        : { required: false })
    },
    {
      model: MarketingCampaign,
      as: "marketingCampaign",
      required: false
    }
  ];

  return includeCondition;
};

const buildIncludeConditionForCount = ({
  searchParam,
  categoryId,
  userId,
  showOnlyMyGroups,
  typeIds,
  clientelicenciaEtapaIds,
}: Request): Includeable[] => {
  const includeCondition: Includeable[] = [];

  // ---------------------------------------------------------------
  // Contact (solo si searchParam existe o si clientelicenciaEtapaIds aplica)
  // ---------------------------------------------------------------
  const needsContact =
    Boolean(searchParam) ||
    (clientelicenciaEtapaIds && clientelicenciaEtapaIds.length > 0);

  if (needsContact) {
    includeCondition.push({
      model: Contact,
      as: "contact",
      attributes: [],
      required: true,
      include: [
        ...(clientelicenciaEtapaIds && clientelicenciaEtapaIds.length > 0
          ? [
              {
                model: ContactClientelicencias,
                as: "contactClientelicencias",
                required: false,
                attributes: []
              }
            ]
          : [])
      ]
    });
  }

  // ---------------------------------------------------------------
  // Category (solo si categoryId existe)
  // ---------------------------------------------------------------
  if (categoryId > 0) {
    includeCondition.push({
      model: Category,
      as: "categories",
      attributes: [],
      where: { id: categoryId },
      required: true
    });
  }

  // ---------------------------------------------------------------
  // ParticipantUsers (solo si es para ver mis grupos)
  // ---------------------------------------------------------------
  if (showOnlyMyGroups && typeIds.length === 1 && typeIds.includes("group")) {
    includeCondition.push({
      model: User,
      as: "participantUsers",
      attributes: [],
      where: {
        id: +userId
      },
      required: true
    })
  }

  return includeCondition;
  // return [];
};

const ListTicketsService = async (request: Request): Promise<Response> => {
  const { pageNumber = "1", status, viewSource, ticketsType } = request;

  const logPrefix = `[ListTickets]`;
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const user = await User.findByPk(+request.userId, {
    attributes: ["name", "id", "profile", "whatsappId"],
    include: [
      {
        model: Whatsapp,
        attributes: ["id"],
        as: "userWhatsapps",
        required: false
      }
    ]
  });

  request.userWhatsappsId = user.userWhatsapps.map(whatsapp => whatsapp.id);
  
  // ✅ FIX: Fallback a columna legado whatsappId si existe
  if (user.whatsappId && !request.userWhatsappsId.includes(user.whatsappId)) {
    request.userWhatsappsId.push(user.whatsappId);
  }


  request.profile = user.profile;

  // Construcción de WHERE
  let whereCondition = await buildWhereCondition(request);
  
  let includeCondition = buildIncludeCondition(request);
  let includeConditionForCount = buildIncludeConditionForCount(request);

  const limit = 10;
  const offset = limit * (+pageNumber - 1);

  // Ejecutando Ticket.findAll
  const tickets = await Ticket.findAll({
    where: whereCondition,
    include: includeCondition,
    limit,
    offset,
    order: [["lastMessageTimestamp", "DESC"]],
    // logging(sql) {
    //   console.log("🔍 SQL FINDALL:", sql);
    // }
  });
  
  

  // Conteo
  const count = await Ticket.count({
    where: whereCondition,
    include: includeConditionForCount,
    distinct: true
  });
  
  

  const hasMore = count > offset + tickets.length;

  if (status === "closed") {
  }

  const filteredTickets = await filterWhenAksForClosedTickets(tickets, status);

  if (status === "closed") {
  }

  const ticketsToReturn = filteredTickets || tickets;

  // Fin del servicio

  return {
    tickets: ticketsToReturn,
    count,
    hasMore,
    whereCondition,
    includeCondition
  };
};

// Función para filtrar solamente cuando piden los tickets cerrados
// hace un filtrado para devolver los cerrados que no tengan
// un ticket hermano abierto o pendiente
const filterWhenAksForClosedTickets = async (
  tickets: Ticket[],
  status: string | undefined
): Promise<Ticket[] | null> => {
  if (status !== "closed") return null;

  // OPTIMIZACIÓN: En vez de hacer 1 query por ticket, hacemos UNA sola query
  // para obtener todos los tickets conflictivos de una vez
  if (tickets.length === 0) return [];

  // Extraer pares únicos de whatsappId + contactId
  const ticketPairs = tickets.map(t => ({
    whatsappId: t.whatsappId,
    contactId: t.contactId
  }));

  // Query única que busca todos los conflictos de una vez
  const conflictingTickets = await Ticket.findAll({
    attributes: ["whatsappId", "contactId"],
    where: {
      [Op.or]: ticketPairs.map(pair => ({
        whatsappId: pair.whatsappId,
        contactId: pair.contactId
      })),
      status: ["pending", "open"]
    },
    raw: true
  });

  // Crear Set para búsqueda rápida O(1)
  const conflictSet = new Set(
    conflictingTickets.map((t: any) => `${t.whatsappId}-${t.contactId}`)
  );

  // Filtrar tickets que NO tienen conflicto
  return tickets.filter(ticket => {
    const key = `${ticket.whatsappId}-${ticket.contactId}`;
    return !conflictSet.has(key);
  });
};

export default ListTicketsService;
