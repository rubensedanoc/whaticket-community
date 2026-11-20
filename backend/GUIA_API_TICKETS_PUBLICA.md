# Guía de uso — API pública de tickets

API de solo lectura para consultar los tickets de atención y **todas sus
respuestas**, pensada para verificación end-to-end automatizada.

No requiere autenticación.

---

## 1. Dirección base

```
https://{HOST_DEL_AMBIENTE}
```

> Reemplazá `{HOST_DEL_AMBIENTE}` por la dirección del backend que vas a
> consultar. Los ejemplos de abajo la escriben como `{BASE}`.

## 2. Endpoints

| Método | Ruta | Para qué |
|---|---|---|
| `GET` | `/external/tickets` | Listado paginado de tickets con sus respuestas |
| `GET` | `/external/tickets/{ticketId}` | Un ticket puntual con sus respuestas |

Llamada mínima — trae la primera página del año en curso:

```
GET {BASE}/external/tickets
```

---

## 3. Parámetros

Todos van por query string y todos son opcionales.

### Rango de fechas

| Parámetro | Formato | Por defecto | Qué hace |
|---|---|---|---|
| `year` | entero de 4 dígitos | año en curso | Devuelve los tickets de ese año. Ej: `year=2026` |
| `startDate` | `YYYY-MM-DD` | — | Desde esta fecha, inclusive |
| `endDate` | `YYYY-MM-DD` | — | Hasta esta fecha, inclusive |
| `dateField` | `createdAt` o `updatedAt` | `createdAt` | Sobre qué fecha se filtra |

Si mandás `startDate` o `endDate`, se ignora `year`. Si mandás solo uno de los
dos, el otro se completa con el inicio o el fin de ese mismo año.

Las fechas se interpretan y se devuelven en **zona horaria de Lima
(America/Lima, UTC-5)**. El día indicado se incluye completo: `startDate`
arranca a las 00:00:00 y `endDate` termina a las 23:59:59.

### Paginación

| Parámetro | Por defecto | Qué hace |
|---|---|---|
| `page` | `1` | Número de página, empieza en 1 |
| `pageSize` | `200` | Registros por página. **Máximo 200** |

Si pedís un `pageSize` mayor a 200 no da error: se recorta al tope y el valor
real aplicado viene en `pagination.pageSize`.

### Filtros

| Parámetro | Por defecto | Qué hace |
|---|---|---|
| `status` | — | `pending`, `open`, `closed` |
| `queueId` | — | Solo los de ese departamento |
| `whatsappId` | — | Solo los de esa conexión de WhatsApp |
| `excludeGroups` | `false` | `true` deja fuera los tickets de grupos |

### Contenido de la respuesta

| Parámetro | Por defecto | Qué hace |
|---|---|---|
| `includeMessages` | `true` | `false` omite el arreglo `respuestas` y devuelve solo el ticket con sus contadores. **Mucho más rápido** |
| `includePrivate` | `false` | `true` incluye las notas internas del equipo |

Los booleanos aceptan `true`, `1`, `yes`, `si`.

---

## 4. Ejemplos

Primera página del 2026, de 200 en 200:

```
/external/tickets?year=2026&page=1&pageSize=200
```

Un mes concreto:

```
/external/tickets?startDate=2026-03-01&endDate=2026-03-31
```

Solo cerrados, sin grupos, sin traer los mensajes:

```
/external/tickets?year=2026&status=closed&excludeGroups=true&includeMessages=false
```

Un ticket puntual (no le afecta el filtro de año):

```
/external/tickets/1234
```

---

## 5. Estructura de la respuesta

```jsonc
{
  "success": true,

  "filters": {                    // eco de los filtros realmente aplicados
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
    "totalRecords": 28943,        // total de tickets que cumplen el filtro
    "totalPages": 145,
    "hasNextPage": true,
    "hasPreviousPage": false
  },

  "data": [ /* los tickets */ ]
}
```

### Un ticket

```jsonc
{
  "id": 1234,
  "status": "closed",
  "esGrupo": false,
  "createdAt": "2026-03-12 10:15:21",      // siempre hora de Lima
  "updatedAt": "2026-03-13 09:46:16",
  "ultimoMensaje": "Lidia *resolvió* la conversación",
  "ultimoMensajeFecha": "2026-03-13 09:46:16",
  "mensajesSinLeer": 0,
  "agenteTuvoContacto": true,              // si un humano llegó a responder
  "transferido": false,

  "contacto": {
    "id": 1,
    "nombre": "Juan Pérez",
    "numero": "51900000000",
    "email": null,
    "esGrupo": false,
    "esMiembroDeLaEmpresa": false,
    "dominio": "cliente.restaurant.pe",
    "trazaClientelicenciaId": null
  },

  "conexion": {                            // por qué número entró el ticket
    "id": 1,
    "nombre": "SOPORTE RESTAURANTPE",
    "numero": "51900000000"
  },

  "departamento": { "id": 1, "nombre": "Soporte En Linea" },

  "agenteAsignado": {
    "id": 3,
    "nombre": "Lidia",
    "email": "agente@restaurant.pe"
  },

  "categorias": [ { "id": 5, "nombre": "Facturación" } ],

  "chatbot": {
    "identifier": null,
    "ultimoPaso": null
  },

  "resumenRespuestas": { /* ver abajo */ },
  "respuestas": [ /* ver abajo */ ]
}
```

`departamento`, `agenteAsignado`, `conexion` y `contacto` pueden venir en `null`
si el ticket no los tiene asignados.

### Contadores del ticket

Vienen precalculados para no tener que recorrer el arreglo:

```jsonc
"resumenRespuestas": {
  "total": 7,
  "delCliente": 3,
  "deNuestroLado": 4,
  "deAgente": 4,
  "deBot": 0,
  "deMiembroEmpresa": 0,
  "primerMensajeClienteFecha": "2026-03-12 10:15:20",
  "primeraRespuestaNuestraFecha": "2026-03-12 10:43:58",
  "truncado": false              // true si el ticket superó las 500 respuestas
}
```

Se cumple siempre:

```
delCliente + deNuestroLado = total
deAgente + deBot + deMiembroEmpresa = deNuestroLado
```

`resumenRespuestas` viene **aunque uses `includeMessages=false`**, así que sirve
para validar volúmenes sin descargar las conversaciones.

### Una respuesta

```jsonc
{
  "id": "wamid.HBgLNTE5...",      // id del mensaje en WhatsApp
  "origen": "CLIENTE",
  "esNuestro": false,
  "lado": "CLIENTE",
  "direccion": "ENTRANTE",
  "fromMe": false,

  "autor": {
    "tipo": "CLIENTE",
    "nombre": "Juan Pérez",
    "contactId": 1,
    "esMiembroDeLaEmpresa": false
  },

  "body": "Hola, buen día",
  "mediaType": null,              // "image", "audio", "document", "chat"...
  "mediaUrl": null,               // URL del archivo adjunto, si lo hay
  "timestamp": 1772118920,        // unix, en segundos
  "fecha": "2026-03-12 10:15:20", // el mismo timestamp en hora de Lima
  "createdAt": "2026-03-12 10:15:21",
  "ack": 0,                       // estado de entrega
  "leido": true,
  "esNotaInterna": false,
  "eliminado": false,
  "editado": false,
  "chatbotIdentifier": null,      // paso del bot, solo cuando origen = BOT
  "quotedMsgId": null             // id del mensaje citado, si responde a otro
}
```

Las respuestas vienen **en orden cronológico**, de la más antigua a la más
reciente. El tope es de **500 por ticket**; si se supera, `truncado` viene en
`true`.

---

## 6. Cómo distinguir nuestras respuestas de las del cliente

Es la parte central de la API. Cada respuesta trae **cuatro campos redundantes a
propósito**, para que uses el que te quede más cómodo:

| Campo | Valores | Significado |
|---|---|---|
| `origen` | `CLIENTE` · `AGENTE` · `BOT` · `MIEMBRO_EMPRESA` | Quién la escribió |
| `esNuestro` | `true` / `false` | El booleano directo: ¿salió de nuestro lado? |
| `lado` | `EMPRESA` / `CLIENTE` | Lo mismo, en texto |
| `direccion` | `SALIENTE` / `ENTRANTE` | Dirección real del mensaje en WhatsApp |

### Los cuatro orígenes

| `origen` | `esNuestro` | `lado` | `direccion` | Cuándo |
|---|---|---|---|---|
| `CLIENTE` | `false` | `CLIENTE` | `ENTRANTE` | Lo escribió el cliente |
| `AGENTE` | `true` | `EMPRESA` | `SALIENTE` | Lo escribió una persona del equipo |
| `BOT` | `true` | `EMPRESA` | `SALIENTE` | Lo envió el chatbot automáticamente |
| `MIEMBRO_EMPRESA` | `true` | `EMPRESA` | **`ENTRANTE`** | Un colaborador escribiendo desde su propio número, dentro de un ticket de grupo |

Fijate en la última fila: es el único caso donde `lado` y `direccion` no
coinciden. El mensaje **entra** a la plataforma, pero **no lo escribió el
cliente**. Por eso cuenta como nuestro.

### La regla práctica

Para separar las dos conversaciones, usá `esNuestro`:

```javascript
const delCliente  = ticket.respuestas.filter(r => !r.esNuestro);
const nuestras    = ticket.respuestas.filter(r =>  r.esNuestro);
```

Y si necesitás separar lo automático de lo humano:

```javascript
const delBot      = ticket.respuestas.filter(r => r.origen === "BOT");
const deUnAgente  = ticket.respuestas.filter(r => r.origen === "AGENTE");
```

### Dos detalles sobre `autor`

1. **En las respuestas de `AGENTE`, `autor.nombre` viene en `null`.** La tabla de
   mensajes no guarda qué usuario envió cada uno, solo que salió de la empresa.
   Para saber quién atendía el ticket, usá `agenteAsignado` a nivel de ticket.
   Muchos mensajes además traen el nombre al inicio del `body`, con el formato
   `*Administrador:*\n...`, pero eso es texto, no un campo.

2. **En las de `BOT`, `autor.nombre` es `"Chatbot"`** y `chatbotIdentifier` trae
   el paso del flujo que lo generó (por ejemplo `soporte`, o un UUID).

---

## 7. Errores

| Código | Cuándo |
|---|---|
| `200` | Todo bien. Si no hay coincidencias, `data` viene vacío y `totalRecords` en `0` |
| `400` | Un parámetro mal formado |
| `404` | `/external/tickets/{id}` de un ticket que no existe |
| `500` | Error del servidor |

Formato del error:

```json
{
  "error": "El parámetro \"year\" debe ser un año válido de 4 dígitos (ej. 2026)",
  "logs": []
}
```

El mensaje a mostrar está en `error`. El campo `logs` es de diagnóstico interno
y normalmente viene vacío.

Casos que dan `400`:

- `year` que no sea un entero de 4 dígitos entre 2000 y 2100
- `page` o `pageSize` que no sean enteros positivos (`0` y negativos incluidos)
- Fechas que no respeten `YYYY-MM-DD`, como `2026-3-1`
- Fechas inexistentes, como `2026-13-45` o `2026-02-30`
- `endDate` anterior a `startDate`

---

## 8. Recorrer un año completo

```javascript
const BASE = "https://{HOST_DEL_AMBIENTE}";

async function traerTodos(year) {
  const tickets = [];
  let page = 1;
  let totalPages = 1;

  do {
    const res = await fetch(
      `${BASE}/external/tickets?year=${year}&page=${page}&pageSize=200`
    );
    if (!res.ok) throw new Error(`Página ${page}: HTTP ${res.status}`);

    const json = await res.json();
    tickets.push(...json.data);
    totalPages = json.pagination.totalPages;
    page++;
  } while (page <= totalPages);

  return tickets;
}
```

**Recomendación:** si solo necesitás el conteo o los metadatos, agregá
`includeMessages=false`. La diferencia de peso y tiempo es grande, porque un
ticket puede traer más de 100 respuestas.

Para saber cuántas páginas vas a recorrer antes de empezar, pedí una sola:

```
/external/tickets?year=2026&pageSize=1&includeMessages=false
```

y mirá `pagination.totalPages`.

---

## 9. Estado verificado

El mismo endpoint se probó contra el ambiente de la migración a Meta el
**18/11/2026**, con 45 comprobaciones en verde: paginación sin solapamiento,
filtro por año, clasificación de los tres orígenes presentes en los datos
(`CLIENTE`, `AGENTE`, `BOT`), contadores cuadrados y validaciones devolviendo
400.

**Esta versión, la de `master`, todavía no se probó contra su propio
ambiente.** Antes de darla por buena conviene correr la misma batería apuntando
al backend correspondiente, porque la base de datos es distinta.

`MIEMBRO_EMPRESA` no apareció en ninguna de las muestras revisadas, así que esa
clasificación **no está verificada contra datos reales** en ningún ambiente.

---

## 10. Límites a tener en cuenta

- `pageSize` tiene un tope duro de **200**
- Máximo **500 respuestas por ticket**; el campo `truncado` avisa cuando se
  alcanzó
- El endpoint es **público y sin autenticación**: no expongas la URL más allá de
  lo necesario
- Es de **solo lectura**, no modifica nada
- `mediaUrl` apunta a archivos servidos por el propio backend, con el formato
  `{BACKEND_URL}:{PROXY_PORT}/public/archivo.jpg`, y puede venir en `null`
  aunque `mediaType` tenga valor
