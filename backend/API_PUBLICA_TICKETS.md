# API Pública de Tickets (verificación E2E)

Endpoint público (sin autenticación interna) para consultar los tickets de un año
y **todas sus respuestas**, diferenciando las de nuestro lado de las del cliente.

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/external/tickets` | Listado paginado de tickets del año indicado, con sus respuestas |
| `GET` | `/external/tickets/:ticketId` | Un ticket puntual con sus respuestas (sin filtro de año) |

Viven bajo `/external`, junto a las demás integraciones externas del sistema
(`sendMessage`, `getUpdatedTickets`, `reportToExcelDaily`, …), y se declaran en
`src/routes/externalRoutes.ts`.

## Parámetros (query string)

| Parámetro | Tipo | Default | Descripción |
|---|---|---|---|
| `year` | entero | año en curso | Año a consultar, p. ej. `2026` |
| `startDate` | `YYYY-MM-DD` | — | Si se envía, reemplaza a `year` |
| `endDate` | `YYYY-MM-DD` | — | Si se envía, reemplaza a `year` |
| `page` | entero ≥ 1 | `1` | Página a consultar |
| `pageSize` | entero ≥ 1 | `200` | Registros por página (**máximo 200**) |
| `dateField` | `createdAt` \| `updatedAt` | `createdAt` | Campo de fecha sobre el que se filtra |
| `status` | string | — | `pending`, `open`, `closed`, … |
| `queueId` | entero | — | Filtrar por departamento |
| `whatsappId` | entero | — | Filtrar por conexión |
| `excludeGroups` | bool | `false` | Excluir tickets de grupos |
| `includePrivate` | bool | `false` | Incluir notas internas privadas |
| `includeMessages` | bool | `true` | `false` devuelve solo el ticket + contadores (más rápido) |

Las fechas se interpretan y devuelven en zona horaria **America/Lima**, igual que
los reportes del sistema.

Por ticket se devuelven como máximo **500** respuestas, ordenadas
cronológicamente (`timestamp ASC`). Si se alcanza el tope,
`resumenRespuestas.truncado` llega en `true`.

## Ejemplos

```powershell
curl "https://tu-dominio/external/tickets?year=2026&page=1&pageSize=200"
```

```powershell
curl "https://tu-dominio/external/tickets?year=2026&page=2&pageSize=200&excludeGroups=true&status=closed"
```

```powershell
curl "https://tu-dominio/external/tickets/123456"
```

## Cómo se diferencia nuestro lado del lado del cliente

Cada respuesta trae estos campos redundantes a propósito, para que el consumidor
use el que le resulte más cómodo:

| Campo | Valores | Significado |
|---|---|---|
| `origen` | `CLIENTE` \| `AGENTE` \| `BOT` \| `MIEMBRO_EMPRESA` | Quién la envió |
| `esNuestro` | `true` / `false` | `true` para `AGENTE`, `BOT` y `MIEMBRO_EMPRESA` |
| `lado` | `EMPRESA` \| `CLIENTE` | Equivalente a `esNuestro` |
| `direccion` | `SALIENTE` \| `ENTRANTE` | Dirección del mensaje |
| `fromMe` | `true` / `false` | Valor crudo de la BD |

Reglas aplicadas:

- `fromMe = false` → **CLIENTE** (mensaje entrante).
- `fromMe = false` pero el contacto tiene `isCompanyMember = true` →
  **MIEMBRO_EMPRESA**. Pasa en tickets de grupo, cuando un colaborador escribe
  desde su propio número: es entrante (`direccion: "ENTRANTE"`) pero no viene
  del cliente, así que cuenta como nuestro lado (`esNuestro: true`).
- `fromMe = true` y el mensaje tiene `identifier` de un paso del chatbot →
  **BOT** (el `identifier` se expone en `chatbotIdentifier`).
- `fromMe = true` sin `identifier` → **AGENTE** (lo escribió una persona).

El identificador interno `SKIP_UNREAD_RESET` se ignora en esta clasificación
porque no corresponde a un paso del chatbot.

`direccion` siempre refleja el dato crudo (`fromMe`), mientras que `lado` y
`esNuestro` reflejan la clasificación. Por eso un `MIEMBRO_EMPRESA` sale como
`lado: "EMPRESA"` + `direccion: "ENTRANTE"`.

### Autor del mensaje

`autor.contactId`, `autor.nombre` y `autor.esMiembroDeLaEmpresa` solo vienen
poblados en mensajes **entrantes**, porque son los únicos en los que el contacto
guardado identifica a quien escribió. En los salientes la BD guarda el contacto
del ticket (el cliente), no el agente, y la tabla `Messages` no tiene `userId`:
por eso en `AGENTE` el `autor.nombre` llega en `null`. Para saber quién atendía
el ticket, usa `agenteAsignado` a nivel de ticket. En `BOT` el nombre es
`"Chatbot"`.

Además, cada ticket trae un `resumenRespuestas` con los conteos ya calculados
(`delCliente`, `deNuestroLado`, `deAgente`, `deBot`, `deMiembroEmpresa`) y las
fechas del primer mensaje del cliente y de la primera respuesta nuestra.

## Estructura de la respuesta

```json
{
  "success": true,
  "filters": {
    "year": 2026,
    "startDate": "2026-01-01 00:00:00-05:00",
    "endDate": "2026-12-31 23:59:59-05:00",
    "dateField": "createdAt",
    "timezone": "America/Lima",
    "status": null,
    "queueId": null,
    "whatsappId": null,
    "excludeGroups": false,
    "includePrivate": false,
    "includeMessages": true
  },
  "pagination": {
    "page": 1,
    "pageSize": 200,
    "totalRecords": 4873,
    "totalPages": 25,
    "hasNextPage": true,
    "hasPreviousPage": false
  },
  "data": [
    {
      "id": 123456,
      "status": "closed",
      "esGrupo": false,
      "createdAt": "2026-01-03 09:12:44",
      "updatedAt": "2026-01-03 09:48:10",
      "ultimoMensaje": "Gracias, quedo atento",
      "ultimoMensajeFecha": "2026-01-03 09:47:55",
      "mensajesSinLeer": 0,
      "agenteTuvoContacto": true,
      "transferido": false,
      "contacto": {
        "id": 882,
        "nombre": "Juan Pérez",
        "numero": "51999888777",
        "email": null,
        "esGrupo": false,
        "esMiembroDeLaEmpresa": false,
        "dominio": "cliente.com",
        "trazaClientelicenciaId": 4412
      },
      "conexion": { "id": 3, "nombre": "Soporte", "numero": "5117000000" },
      "departamento": { "id": 2, "nombre": "Soporte Técnico" },
      "agenteAsignado": { "id": 17, "nombre": "Ana Torres", "email": "ana@empresa.com" },
      "categorias": [{ "id": 5, "nombre": "Facturación" }],
      "chatbot": {
        "identifier": "menu_principal",
        "ultimoPaso": "soporte_tecnico"
      },
      "resumenRespuestas": {
        "total": 12,
        "delCliente": 5,
        "deNuestroLado": 7,
        "deAgente": 4,
        "deBot": 3,
        "deMiembroEmpresa": 0,
        "primerMensajeClienteFecha": "2026-01-03 09:12:44",
        "primeraRespuestaNuestraFecha": "2026-01-03 09:12:47",
        "truncado": false
      },
      "respuestas": [
        {
          "id": "3EB0C2B1...",
          "origen": "CLIENTE",
          "esNuestro": false,
          "lado": "CLIENTE",
          "direccion": "ENTRANTE",
          "fromMe": false,
          "autor": {
            "tipo": "CLIENTE",
            "nombre": "Juan Pérez",
            "contactId": 882,
            "esMiembroDeLaEmpresa": false
          },
          "body": "Buenos días, tengo un problema con mi factura",
          "mediaType": "chat",
          "mediaUrl": null,
          "timestamp": 1767445964,
          "fecha": "2026-01-03 09:12:44",
          "createdAt": "2026-01-03 09:12:45",
          "ack": 3,
          "leido": true,
          "esNotaInterna": false,
          "eliminado": false,
          "editado": false,
          "chatbotIdentifier": null,
          "quotedMsgId": null
        },
        {
          "id": "wamid.HBgL...",
          "origen": "BOT",
          "esNuestro": true,
          "lado": "EMPRESA",
          "direccion": "SALIENTE",
          "fromMe": true,
          "autor": { "tipo": "BOT", "nombre": "Chatbot", "contactId": null, "esMiembroDeLaEmpresa": null },
          "body": "¡Hola! Elige una opción: 1) Soporte 2) Ventas",
          "mediaType": null,
          "mediaUrl": null,
          "timestamp": 1767445967,
          "fecha": "2026-01-03 09:12:47",
          "createdAt": "2026-01-03 09:12:47",
          "ack": 3,
          "leido": true,
          "esNotaInterna": false,
          "eliminado": false,
          "editado": false,
          "chatbotIdentifier": "menu_principal",
          "quotedMsgId": null
        },
        {
          "id": "wamid.HBgM...",
          "origen": "AGENTE",
          "esNuestro": true,
          "lado": "EMPRESA",
          "direccion": "SALIENTE",
          "fromMe": true,
          "autor": { "tipo": "AGENTE", "nombre": null, "contactId": null, "esMiembroDeLaEmpresa": null },
          "body": "Buenos días Juan, reviso tu caso ahora mismo",
          "mediaType": null,
          "mediaUrl": null,
          "timestamp": 1767446400,
          "fecha": "2026-01-03 09:20:00",
          "createdAt": "2026-01-03 09:20:00",
          "ack": 3,
          "leido": true,
          "esNotaInterna": false,
          "eliminado": false,
          "editado": false,
          "chatbotIdentifier": null,
          "quotedMsgId": null
        }
      ]
    }
  ]
}
```

## Errores

| Código | Caso |
|---|---|
| `400` | `year`, `page`, `pageSize` o fechas inválidas; `endDate` anterior a `startDate` |
| `401` | Solo si se configuró `PUBLIC_TICKETS_API_TOKEN` y el token no coincide |
| `404` | `GET /external/tickets/:ticketId` de un ticket inexistente |

Formato de error (middleware global de `app.ts`):

```json
{ "error": "El parámetro \"year\" debe ser un año válido de 4 dígitos (ej. 2026)" }
```

## Token opcional

El endpoint es público por defecto. Si en algún momento se necesita cerrarlo sin
tocar código, basta definir en el `.env` del backend:

```
PUBLIC_TICKETS_API_TOKEN=algún-token-largo
```

Con la variable definida se exige el token en `x-api-token`, en
`Authorization: Bearer <token>` o en `?token=`. Sin la variable, no se pide nada.

## Recorrido completo del año (ejemplo de consumo)

```javascript
let page = 1;
let totalPages = 1;
const tickets = [];

do {
  const res = await fetch(
    `https://tu-dominio/external/tickets?year=2026&page=${page}&pageSize=200`
  );
  const json = await res.json();
  tickets.push(...json.data);
  totalPages = json.pagination.totalPages;
  page += 1;
} while (page <= totalPages);
```

## Archivos

- `src/services/TicketServices/ListPublicTicketsService.ts` — consulta, filtros, paginación y serialización
- `src/controllers/PublicTicketsController.ts` — controladores `index` y `show`
- `src/routes/externalRoutes.ts` — rutas `GET /tickets` y `GET /tickets/:ticketId`

## Diferencias respecto a la rama de migración a Meta

Esta versión corre sobre `master`, que todavía no tiene la migración a la API de
Meta. Por eso hay tres diferencias respecto al mismo endpoint en
`feat/migracion-meta-api-v2`:

- **`conexion` no trae `apiType`**: la columna `Whatsapps.apiType` no existe en
  master, donde todas las conexiones son de `whatsapp-web.js`.
- **`chatbot` solo trae `identifier` y `ultimoPaso`**: los campos
  `finalizadoEn`, `categoriaSeleccionada` y `subcategoriaSeleccionada` no
  existen en el modelo `Ticket` de master.
- **`mediaUrl` apunta a archivos locales**, con el formato
  `{BACKEND_URL}:{PROXY_PORT}/public/archivo.jpg`, en vez de a S3.

Todo lo demás (filtros, paginación, clasificación de respuestas, validaciones)
se comporta igual.
