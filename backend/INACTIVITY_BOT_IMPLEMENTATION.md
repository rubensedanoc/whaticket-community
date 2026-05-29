# Bot Proactivo "Inactividad" - Implementación Completa

## Tabla de Contenidos
1. [Objetivo](#objetivo)
2. [Principios Fundamentales](#principios-fundamentales)
3. [Arquitectura de Datos](#arquitectura-de-datos)
4. [Flujo Completo](#flujo-completo)
5. [Componentes Técnicos](#componentes-técnicos)
6. [Plan de Implementación](#plan-de-implementación)
7. [Decisiones Técnicas](#decisiones-técnicas)

---

## Objetivo

Implementar un bot proactivo (`chatbotIdentifier = 'inactividad'`) que:
- Inicia conversaciones automáticamente con usuarios inactivos
- Envía el primer mensaje usando una plantilla aprobada por Meta
- Maneja sesiones conversacionales con timeout
- **NO crea Tickets ni Contacts** (sesiones independientes)
- Captura todas las respuestas del usuario
- Reporta toda la interacción al sistema externo al finalizar

---

## Principios Fundamentales

### Tipos de Bot

Un bot solo puede ser **REACTIVO** o **PROACTIVO**, nunca ambos:

| Tipo | Comportamiento | Primer Mensaje | Persistencia |
|------|----------------|----------------|--------------|
| **REACTIVO** | Usuario inicia | Texto/Lista interactiva | Crea Ticket + Contact |
| **PROACTIVO** | Sistema inicia | Template Meta (obligatorio) | Solo sesión temporal |

El tipo se define en el registro de `Whatsapp` con el campo `executionType`.

### Ventana de 24 horas (Meta)

- **Bot reactivo**: Ventana abierta por el usuario
- **Bot proactivo**: Ventana NO existe → requiere template para iniciar

### Separación de Flujos

**IMPORTANTE:** El bot proactivo de inactividad:
- ✅ Usa infraestructura de Meta (webhook, MetaApiClient)
- ✅ Usa árbol de ChatbotMessage para navegación
- ❌ NO crea registros en tabla Tickets
- ❌ NO crea registros en tabla Contacts
- ✅ Usa tabla dedicada `ProactiveBotSessions`
- ✅ Envía TODA la interacción al sistema externo

---

## Arquitectura de Datos

### Tabla `Whatsapp` (Sin cambios)

El bot proactivo usa la configuración existente:

```sql
chatbotIdentifier VARCHAR(255) NULL  -- 'inactividad'
executionType ENUM('reactive', 'proactive') DEFAULT 'reactive'
phoneNumberId VARCHAR(255) NULL
metaAccessToken TEXT NULL
```

**Ejemplo de registro:**
```
id: 10
number: +519XXXXXXXX
chatbotIdentifier: 'inactividad'
executionType: 'proactive'
phoneNumberId: '123456789'
metaAccessToken: 'EAAxxxx...'
```

### Tabla `ChatbotMessage` (Sin cambios)

El árbol de mensajes se usa para navegación:

```sql
id INT PRIMARY KEY
identifier VARCHAR(255)  -- 'inactividad', 'soporte_tecnico', etc.
value TEXT  -- Mensaje a mostrar
hasSubOptions BOOLEAN
timeToWaitInMinutes INT  -- Timeout para nodo terminal
```

**Ejemplo de nodo raíz:**
```
id: 100
identifier: 'inactividad'
value: '¿Cuál describe mejor tu situación?'
hasSubOptions: true
timeToWaitInMinutes: 5
```

**Ejemplo de nodo terminal (permite texto libre):**
```
id: 105
identifier: 'describe_problema'
value: 'Por favor descríbenos brevemente qué está ocurriendo'
hasSubOptions: false  -- ← Indica que es nodo terminal
timeToWaitInMinutes: 5
```

### Nueva Tabla `ProactiveBotSessions`

**Propósito:** Almacenar sesiones del bot proactivo de inactividad

```sql
CREATE TABLE ProactiveBotSessions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  
  -- Identificación
  phone VARCHAR(20) NOT NULL,
  whatsappId INT NOT NULL,
  botIdentifier VARCHAR(255) NOT NULL DEFAULT 'inactividad',
  
  -- Estado de la sesión
  status ENUM('ACTIVE', 'COMPLETED', 'NO_RESPONSE', 'FAILED') NOT NULL DEFAULT 'ACTIVE',
  
  -- Navegación del bot
  currentStep VARCHAR(255) NULL,  -- identifier del nodo actual
  
  -- Interacciones del usuario (JSON)
  userInteractions JSON NULL,
  -- Estructura: [
  --   {
  --     "step": "inactividad",
  --     "userResponse": "Necesito soporte técnico",
  --     "timestamp": "2026-04-08T10:01:00Z"
  --   },
  --   ...
  -- ]
  
  -- Respuesta libre final (cuando llega a nodo terminal)
  userFreeTextResponse TEXT NULL,
  
  -- Control de timeout
  waitingForFreeTextSince DATETIME NULL,
  timeoutMinutes INT DEFAULT 5,
  
  -- Metadata
  startedAt DATETIME NOT NULL,
  completedAt DATETIME NULL,
  sentToExternalSystemAt DATETIME NULL,
  
  -- Timestamps
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL,
  
  -- Índices
  INDEX idx_phone (phone),
  INDEX idx_status (status),
  INDEX idx_whatsappId (whatsappId),
  
  FOREIGN KEY (whatsappId) REFERENCES Whatsapps(id) ON DELETE CASCADE
);
```

**Campos clave:**
- `userInteractions`: JSON con TODAS las respuestas del usuario
- `userFreeTextResponse`: Respuesta final en texto libre
- `waitingForFreeTextSince`: Timestamp cuando llegó al nodo terminal
- `sentToExternalSystemAt`: Control de envío al sistema externo

---

## Flujo Completo

### Fase 1: Envío Proactivo del Template

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Sistema Externo detecta usuarios inactivos              │
│    (Lógica interna del sistema externo)                    │
│    Genera lista: ["521234567890", "521987654321"]         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Sistema Externo DISPARA el bot                          │
│    POST /api/test/inactivity-bot                            │
│    Body: { "numbers": ["521234567890", "521987654321"] }  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Bot busca configuración                                  │
│    - Whatsapp WHERE chatbotIdentifier = 'inactividad'      │
│    - Validar: executionType = 'proactive'                  │
│    - ChatbotMessage WHERE identifier = 'inactividad'       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Para cada número destino:                                │
│    a) Verificar si ya existe sesión activa                  │
│       - ProactiveBotSession WHERE phone AND status=ACTIVE  │
│       - Si existe: saltar (evitar duplicados)              │
│    b) Crear ProactiveBotSession:                            │
│       - phone: "521234567890"                              │
│       - whatsappId: 10                                      │
│       - botIdentifier: "inactividad"                       │
│       - status: "ACTIVE"                                    │
│       - currentStep: "AWAITING_VALIDATION"                 │
│       - userInteractions: []                                │
│       - startedAt: now()                                    │
│    c) Enviar template via MetaApiClient.sendTemplate()     │
│       - templateName: 'encuesta_inactividad'               │
│       - to: phone                                           │
│    d) NO guardar Message en BD                              │
│    e) NO emitir eventos socket                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Rate Limiting                                            │
│    - Delay entre mensajes: 20 segundos                      │
│    - Cola de procesamiento secuencial                       │
└─────────────────────────────────────────────────────────────┘
```

### Fase 2: Usuario Responde al Template

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Usuario responde al template                             │
│    - Webhook llega a HandleMetaWebhookMessage               │
│    - Extrae: phone = message.from                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Detectar que es bot proactivo                            │
│    - Buscar ProactiveBotSession WHERE phone                 │
│    - Si NO existe: ignorar (no es sesión proactiva)        │
│    - Si existe y status != 'ACTIVE': ignorar (cerrada)     │
│    - Si existe y status = 'ACTIVE': continuar              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Delegar a HandleProactiveBotInactivityMessage            │
│    - Servicio especializado para bot de inactividad        │
│    - Recibe: message, session, whatsapp                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Procesar respuesta de validación inicial                │
│    - Si currentStep = "AWAITING_VALIDATION":               │
│      • Usuario responde "Sí, continuar" → continuar        │
│      • Usuario responde "No" → cerrar sesión               │
│    - Guardar respuesta en userInteractions                  │
│    - Actualizar currentStep = 'inactividad' (nodo raíz)   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Enviar primer mensaje del árbol                          │
│    - Buscar ChatbotMessage WHERE identifier='inactividad'  │
│    - Enviar mensaje con opciones                            │
│    - Actualizar session.updatedAt                           │
└─────────────────────────────────────────────────────────────┘
```

### Fase 3: Navegación por el Árbol

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Usuario selecciona opción                                │
│    - Ejemplo: "Necesito soporte técnico"                   │
│    - Webhook llega con selectedOptionId                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. HandleProactiveBotInactivityMessage procesa              │
│    - Buscar sesión activa                                   │
│    - Buscar nodo actual: ChatbotMessage WHERE              │
│      identifier = session.currentStep                       │
│    - Buscar opción seleccionada en chatbotOptions          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Guardar interacción del usuario                          │
│    - Agregar a session.userInteractions:                    │
│      {                                                       │
│        step: "inactividad",                                 │
│        userResponse: "Necesito soporte técnico",           │
│        timestamp: "2026-04-08T10:01:00Z"                   │
│      }                                                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Determinar siguiente nodo                                │
│    - Buscar ChatbotMessage WHERE id = selectedOption.id    │
│    - Verificar si hasSubOptions = false (nodo terminal)    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5A. Si NO es nodo terminal (hasSubOptions = true):         │
│     - Enviar mensaje con nuevas opciones                    │
│     - Actualizar session.currentStep                        │
│     - Continuar flujo                                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5B. Si ES nodo terminal (hasSubOptions = false):           │
│     - Enviar mensaje: "Descríbenos tu problema"            │
│     - Actualizar session.currentStep                        │
│     - Marcar session.waitingForFreeTextSince = now()       │
│     - Esperar respuesta libre del usuario                   │
└─────────────────────────────────────────────────────────────┘
```

### Fase 4: Usuario Responde con Texto Libre (Nodo Terminal)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Usuario escribe texto libre                              │
│    - Ejemplo: "Mi sistema no abre, aparece error 500"     │
│    - session.waitingForFreeTextSince != null               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. HandleProactiveBotInactivityMessage detecta              │
│    - Sesión está esperando texto libre                      │
│    - Guardar respuesta final                                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Actualizar sesión:                                       │
│    - userFreeTextResponse = "Mi sistema no abre..."        │
│    - Agregar a userInteractions:                            │
│      {                                                       │
│        step: "describe_problema",                           │
│        userResponse: "Mi sistema no abre...",              │
│        timestamp: "2026-04-08T10:02:00Z"                   │
│      }                                                       │
│    - status = 'COMPLETED'                                   │
│    - completedAt = now()                                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Enviar al sistema externo:                               │
│    POST [EXTERNAL_API_RESULT_URL]                           │
│    Body: {                                                  │
│      "phone": "521234567890",                              │
│      "status": "COMPLETED",                                 │
│      "botIdentifier": "inactividad",                       │
│      "interactions": [                                      │
│        {                                                     │
│          "step": "AWAITING_VALIDATION",                    │
│          "userResponse": "Sí, continuar",                  │
│          "timestamp": "2026-04-08T10:00:30Z"               │
│        },                                                    │
│        {                                                     │
│          "step": "inactividad",                            │
│          "userResponse": "Necesito soporte técnico",       │
│          "timestamp": "2026-04-08T10:01:00Z"               │
│        },                                                    │
│        {                                                     │
│          "step": "describe_problema",                       │
│          "userResponse": "Mi sistema no abre...",          │
│          "timestamp": "2026-04-08T10:02:00Z"               │
│        }                                                     │
│      ],                                                      │
│      "finalResponse": "Mi sistema no abre...",             │
│      "startedAt": "2026-04-08T10:00:00Z",                  │
│      "completedAt": "2026-04-08T10:02:00Z"                 │
│    }                                                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Actualizar sesión:                                       │
│    - sentToExternalSystemAt = now()                         │
└─────────────────────────────────────────────────────────────┘
```

### Fase 5: Timeout (Usuario No Responde)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. CRON detecta sesión expirada                             │
│    - CheckExpiredProactiveBotSessions (cada 5 min)         │
│    - Busca: ProactiveBotSession WHERE                       │
│      status = 'ACTIVE' AND                                  │
│      waitingForFreeTextSince IS NOT NULL AND               │
│      now() - waitingForFreeTextSince > timeoutMinutes      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Enviar mensaje de timeout (opcional)                     │
│    - "Tu sesión ha expirado por inactividad"               │
│    - MetaApiClient.sendText()                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Actualizar sesión:                                       │
│    - status = 'NO_RESPONSE'                                 │
│    - completedAt = now()                                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Enviar al sistema externo:                               │
│    POST [EXTERNAL_API_RESULT_URL]                           │
│    Body: {                                                  │
│      "phone": "521234567890",                              │
│      "status": "NO_RESPONSE",                               │
│      "botIdentifier": "inactividad",                       │
│      "interactions": [                                      │
│        {                                                     │
│          "step": "AWAITING_VALIDATION",                    │
│          "userResponse": "Sí, continuar",                  │
│          "timestamp": "2026-04-08T10:00:30Z"               │
│        },                                                    │
│        {                                                     │
│          "step": "inactividad",                            │
│          "userResponse": "Necesito soporte técnico",       │
│          "timestamp": "2026-04-08T10:01:00Z"               │
│        }                                                     │
│      ],                                                      │
│      "finalResponse": null,                                 │
│      "startedAt": "2026-04-08T10:00:00Z",                  │
│      "completedAt": "2026-04-08T10:06:30Z"                 │
│    }                                                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Actualizar sesión:                                       │
│    - sentToExternalSystemAt = now()                         │
└─────────────────────────────────────────────────────────────┘
```

### Fase 6: Respuesta Después de Sesión Cerrada

```
┌─────────────────────────────────────────────────────────────┐
│ Usuario responde después de timeout o completar flujo      │
│ - session.status != 'ACTIVE'                                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Comportamiento:                                             │
│ - HandleMetaWebhookMessage detecta sesión cerrada          │
│ - NO continuar flujo anterior                               │
│ - Ignorar mensaje (no crear ticket)                        │
│ - Logging para monitoreo                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Componentes Técnicos

### 1. Modelos (TypeScript)

#### `ProactiveBotSession.ts` (NUEVO)
```typescript
import {
  Table,
  Column,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
  DataType
} from "sequelize-typescript";
import Whatsapp from "./Whatsapp";

interface UserInteraction {
  step: string;
  userResponse: string;
  timestamp: string;
}

@Table
class ProactiveBotSession extends Model<ProactiveBotSession> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  phone: string;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @Column
  botIdentifier: string;

  @Column(DataType.ENUM('ACTIVE', 'COMPLETED', 'NO_RESPONSE', 'FAILED'))
  status: 'ACTIVE' | 'COMPLETED' | 'NO_RESPONSE' | 'FAILED';

  @Column
  currentStep: string;

  @Column(DataType.JSON)
  userInteractions: UserInteraction[];

  @Column(DataType.TEXT)
  userFreeTextResponse: string;

  @Column
  waitingForFreeTextSince: Date;

  @Column
  timeoutMinutes: number;

  @Column
  startedAt: Date;

  @Column
  completedAt: Date;

  @Column
  sentToExternalSystemAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default ProactiveBotSession;
```

### 2. Migraciones

#### `20260408000000-create-proactive-bot-sessions.ts` (NUEVO)
```typescript
import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.createTable("ProactiveBotSessions", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      phone: {
        type: DataTypes.STRING(20),
        allowNull: false
      },
      whatsappId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Whatsapps", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      botIdentifier: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'inactividad'
      },
      status: {
        type: DataTypes.ENUM('ACTIVE', 'COMPLETED', 'NO_RESPONSE', 'FAILED'),
        allowNull: false,
        defaultValue: 'ACTIVE'
      },
      currentStep: {
        type: DataTypes.STRING,
        allowNull: true
      },
      userInteractions: {
        type: DataTypes.JSON,
        allowNull: true
      },
      userFreeTextResponse: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      waitingForFreeTextSince: {
        type: DataTypes.DATE,
        allowNull: true
      },
      timeoutMinutes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 5
      },
      startedAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      completedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      sentToExternalSystemAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE(6),
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE(6),
        allowNull: false
      }
    }).then(() => {
      // Crear índices
      return Promise.all([
        queryInterface.addIndex("ProactiveBotSessions", ["phone"]),
        queryInterface.addIndex("ProactiveBotSessions", ["status"]),
        queryInterface.addIndex("ProactiveBotSessions", ["whatsappId"])
      ]);
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("ProactiveBotSessions");
  }
};
```

### 3. Servicios

#### `SendInactivityBotMessageMeta.ts` (MODIFICADO)
**Responsabilidad:** Enviar template inicial a lista de números

**Flujo:**
1. Validar números
2. Buscar Whatsapp con `chatbotIdentifier = 'inactividad'` y `executionType = 'proactive'`
3. Buscar ChatbotMessage raíz con `identifier = 'inactividad'`
4. Para cada número:
   - Verificar si ya existe sesión activa (evitar duplicados)
   - Crear ProactiveBotSession con status='ACTIVE'
   - Enviar template via `MetaApiClient.sendTemplate()`
   - **NO** crear Contact
   - **NO** crear Ticket
   - **NO** guardar Message
   - **NO** emitir eventos socket
5. Respetar rate limiting (20s entre mensajes)

#### `HandleProactiveBotInactivityMessage.ts` (NUEVO)
**Responsabilidad:** Procesar TODAS las respuestas del bot proactivo de inactividad

**Flujo:**
1. Buscar sesión activa por phone
2. Validar que status = 'ACTIVE'
3. Determinar tipo de respuesta:
   - Validación inicial (AWAITING_VALIDATION)
   - Selección de opción (navegación)
   - Texto libre (nodo terminal)
4. Guardar interacción en `userInteractions`
5. Buscar siguiente nodo en ChatbotMessage
6. Enviar mensaje correspondiente
7. Actualizar `currentStep`
8. Si es nodo terminal: marcar `waitingForFreeTextSince`
9. Si usuario responde texto libre: completar sesión y reportar

**Parámetros:**
```typescript
interface HandleProactiveBotInactivityMessageParams {
  message: MetaWebhookMessage;
  session: ProactiveBotSession;
  whatsapp: Whatsapp;
}
```

#### `CheckExpiredProactiveBotSessions.ts` (NUEVO)
**Responsabilidad:** CRON que detecta timeouts

**Flujo:**
1. Buscar sesiones con:
   - `status = 'ACTIVE'`
   - `waitingForFreeTextSince IS NOT NULL`
   - `now() - waitingForFreeTextSince > timeoutMinutes`
2. Para cada sesión:
   - Enviar mensaje de timeout (opcional)
   - Actualizar status a `NO_RESPONSE`
   - Marcar `completedAt`
   - Reportar al sistema externo con todas las interacciones
   - Marcar `sentToExternalSystemAt`

#### `ReportProactiveBotResultService.ts` (MODIFICADO)
**Responsabilidad:** Enviar resultados al sistema externo

**Parámetros:**
```typescript
interface ReportProactiveBotResultParams {
  session: ProactiveBotSession;
}
```

**Payload enviado:**
```typescript
{
  phone: session.phone,
  status: session.status,
  botIdentifier: session.botIdentifier,
  interactions: session.userInteractions,
  finalResponse: session.userFreeTextResponse,
  startedAt: session.startedAt,
  completedAt: session.completedAt
}
```

**Implementación:**
```typescript
await axios.post(process.env.EXTERNAL_API_RESULT_URL, payload);
```

### 4. Controladores

#### `InactivityBotController.ts`
```typescript
// POST /api/test/inactivity-bot
export const triggerInactivityBot = async (req, res) => {
  const { numbers } = req.body;
  
  // Validaciones
  if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
    return res.status(400).json({ error: "numbers is required" });
  }
  
  // Llamar servicio
  const result = await SendInactivityBotMessageMeta({ numbers });
  
  return res.json(result);
};
```

### 5. Rutas

#### `inactivityBotRoutes.ts`
```typescript
import { Router } from "express";
import * as InactivityBotController from "../controllers/InactivityBotController";

const routes = Router();

routes.post("/test/inactivity-bot", InactivityBotController.triggerInactivityBot);

export default routes;
```

### 6. Adaptaciones en Código Existente

#### `HandleMetaWebhookMessage.ts` (MODIFICADO)
**Cambios necesarios:**

Agregar detección de sesiones proactivas ANTES de procesar tickets normales:

```typescript
const processMessage = async (
  message: MetaWebhookMessage,
  value: any,
  whatsapp: Whatsapp
): Promise<void> => {
  try {
    const phone = message.from;
    
    // ========================================
    // DETECTAR BOT PROACTIVO DE INACTIVIDAD
    // ========================================
    const proactiveSession = await ProactiveBotSession.findOne({
      where: {
        phone: phone,
        status: 'ACTIVE'
      },
      include: [{ model: Whatsapp, as: 'whatsapp' }]
    });
    
    if (proactiveSession) {
      console.log(`[HandleMetaWebhookMessage] Sesión proactiva detectada para ${phone}`);
      
      // Delegar a handler especializado
      await HandleProactiveBotInactivityMessage({
        message,
        session: proactiveSession,
        whatsapp: proactiveSession.whatsapp
      });
      
      return; // NO continuar con flujo normal de tickets
    }
    
    // ========================================
    // FLUJO NORMAL (BOTS REACTIVOS)
    // ========================================
    // ... código existente para crear/buscar ticket
    // ... procesamiento normal de chatbot reactivo
  } catch (err) {
    console.error("[HandleMetaWebhookMessage] Error:", err);
    Sentry.captureException(err);
  }
};
```

**Importante:** El bot proactivo tiene prioridad. Si existe sesión activa, NO se crea ticket.

---

## Plan de Implementación

### Fase 1: Base de Datos (Día 1)

#### Tarea 1.1: Migración `executionType` en Whatsapp
- [ ] Crear archivo de migración
- [ ] Agregar columna con ENUM
- [ ] Probar migración up/down
- [ ] Ejecutar: `npm run build && npx sequelize db:migrate`

#### Tarea 1.2: Actualizar modelo `Whatsapp.ts`
- [ ] Agregar campo `executionType`
- [ ] Agregar tipo TypeScript

#### Tarea 1.3: Migración `templateName` en ChatbotMessage
- [ ] Crear archivo de migración
- [ ] Agregar columna VARCHAR nullable
- [ ] Probar migración up/down
- [ ] Ejecutar migración

#### Tarea 1.4: Actualizar modelo `ChatbotMessage.ts`
- [ ] Agregar campo `templateName`

#### Tarea 1.5: Migración `proactiveBotStatus` en Ticket
- [ ] Crear archivo de migración
- [ ] Agregar columna ENUM nullable
- [ ] Probar migración up/down
- [ ] Ejecutar migración

#### Tarea 1.6: Actualizar modelo `Ticket.ts`
- [ ] Agregar campo `proactiveBotStatus`
- [ ] Agregar tipo TypeScript

### Fase 2: Correcciones en Código Existente (Día 1-2)

#### Tarea 2.1: Corregir `CheckExpiredChatbotSessions.ts`
- [ ] Cambiar línea 56: `identifier: "soporte"` → `identifier: ticket.chatbotMessageIdentifier`
- [ ] Probar con bot reactivo existente
- [ ] Verificar que no rompa funcionalidad actual

### Fase 3: Servicio de Envío Proactivo (Día 2-3)

#### Tarea 3.1: Crear `SendInactivityBotMessageMeta.ts`
- [ ] Implementar validaciones de entrada
- [ ] Buscar configuración de Whatsapp proactivo
- [ ] Buscar nodo raíz con templateName
- [ ] Implementar cola con rate limiting
- [ ] Para cada número:
  - [ ] Crear/obtener Contact
  - [ ] Crear Ticket con campos correctos
  - [ ] Enviar template via MetaApiClient
  - [ ] Guardar Message
  - [ ] Emitir eventos socket
- [ ] Manejo de errores
- [ ] Logging detallado

#### Tarea 3.2: Crear tipos para templates
- [ ] Definir interface `SendProactiveTemplateParams`
- [ ] Agregar a `MetaSendTypes.ts` si es necesario

### Fase 4: Endpoint de Prueba (Día 3)

#### Tarea 4.1: Crear `InactivityBotController.ts`
- [ ] Implementar `triggerInactivityBot`
- [ ] Validaciones de request
- [ ] Llamar a `SendInactivityBotMessageMeta`
- [ ] Respuesta con resultados

#### Tarea 4.2: Crear `inactivityBotRoutes.ts`
- [ ] Definir ruta POST `/api/test/inactivity-bot`
- [ ] Agregar middleware de autenticación si es necesario

#### Tarea 4.3: Registrar rutas en `app.ts`
- [ ] Importar y usar `inactivityBotRoutes`

### Fase 5: Adaptación de Flujo de Respuestas (Día 4)

#### Tarea 5.1: Modificar `HandleMetaWebhookMessage.ts`
- [ ] Detectar si whatsapp es proactivo
- [ ] Validar estado de sesión antes de procesar
- [ ] Ignorar mensajes si sesión no está activa
- [ ] Logging para debugging

#### Tarea 5.2: Modificar `ProcessChatbotResponseMeta.ts`
- [ ] Al completar flujo, verificar si es proactivo
- [ ] Actualizar `proactiveBotStatus = 'COMPLETED'`
- [ ] Llamar a servicio de reporte
- [ ] Manejo de errores específico para proactivos

### Fase 6: Servicio de Reporte (Día 4-5)

#### Tarea 6.1: Crear `ReportProactiveBotResultService.ts`
- [ ] Implementar llamada HTTP al sistema externo
- [ ] Manejo de errores y reintentos
- [ ] Logging de resultados enviados
- [ ] Configurar URL en `.env`

#### Tarea 6.2: Agregar variable de entorno
- [ ] `EXTERNAL_API_RESULT_URL` en `.env.example`
- [ ] Documentar en README

### Fase 7: CRON de Timeout (Día 5-6)

#### Tarea 7.1: Crear `CheckExpiredProactiveBotSessions.ts`
- [ ] Query de tickets con `proactiveBotStatus = 'ACTIVE'`
- [ ] Calcular timeout basado en configuración
- [ ] Enviar mensaje de timeout (opcional)
- [ ] Actualizar estado a `NO_RESPONSE`
- [ ] Cerrar ticket
- [ ] Reportar resultado
- [ ] Logging detallado

#### Tarea 7.2: Registrar CRON en `server.ts`
- [ ] Agregar schedule (ej: cada 5 minutos)
- [ ] Probar ejecución

### Fase 8: Configuración en Meta (Día 6)

#### Tarea 8.1: Crear template en Meta Business Manager
- [ ] Diseñar texto del template
- [ ] Agregar variables si es necesario
- [ ] Enviar para aprobación
- [ ] Esperar aprobación (24-48h)

#### Tarea 8.2: Registrar número en tabla Whatsapp
- [ ] Crear registro con `executionType = 'proactive'`
- [ ] Configurar `chatbotIdentifier = 'inactividad'`
- [ ] Agregar credenciales Meta

#### Tarea 8.3: Crear árbol de ChatbotMessage
- [ ] Nodo raíz con `identifier = 'inactividad'`
- [ ] Agregar `templateName` al nodo raíz
- [ ] Crear nodos hijos (flujo conversacional)
- [ ] Configurar `timeToWaitInMinutes` en raíz

### Fase 9: Pruebas (Día 7)

#### Tarea 9.1: Prueba unitaria de envío
- [ ] Llamar endpoint con 1 número de prueba
- [ ] Verificar template enviado
- [ ] Verificar ticket creado correctamente
- [ ] Verificar mensaje guardado en BD

#### Tarea 9.2: Prueba de flujo completo
- [ ] Usuario responde al template
- [ ] Verificar continuación del flujo
- [ ] Usuario completa flujo
- [ ] Verificar estado `COMPLETED`
- [ ] Verificar reporte enviado

#### Tarea 9.3: Prueba de timeout
- [ ] Enviar template
- [ ] NO responder
- [ ] Esperar timeout
- [ ] Verificar CRON detecta expiración
- [ ] Verificar estado `NO_RESPONSE`
- [ ] Verificar reporte enviado

#### Tarea 9.4: Prueba de respuesta después de cerrar
- [ ] Sesión cerrada por timeout
- [ ] Usuario responde
- [ ] Verificar que NO continúa flujo
- [ ] Verificar comportamiento esperado

#### Tarea 9.5: Prueba de envío masivo
- [ ] Llamar endpoint con 10+ números
- [ ] Verificar rate limiting
- [ ] Verificar todos los templates enviados
- [ ] Verificar logs

### Fase 10: Documentación (Día 7)

#### Tarea 10.1: Documentar API
- [ ] Endpoint de trigger
- [ ] Formato de request/response
- [ ] Códigos de error

#### Tarea 10.2: Documentar configuración
- [ ] Cómo crear template en Meta
- [ ] Cómo configurar número proactivo
- [ ] Cómo crear árbol de mensajes

#### Tarea 10.3: Documentar sistema externo
- [ ] Formato esperado de lista de números
- [ ] Formato de reporte de resultados
- [ ] Webhook de resultados

---

## Decisiones Técnicas

### 1. Modelo de Sesión: Extender Ticket

**Decisión:** Usar tabla `Ticket` existente con campo adicional `proactiveBotStatus`

**Razones:**
- Todo el flujo existente opera sobre tickets
- `ProcessChatbotResponseMeta` ya usa tickets
- `HandleMetaWebhookMessage` ya crea tickets
- Menos código duplicado
- Compatibilidad con bots reactivos (campo nullable)

**Alternativa descartada:** Nueva tabla `ProactiveBotSession`
- Requiere sincronización constante con Ticket
- Duplica lógica de sesión
- Más complejo de mantener

### 2. Tipo de Template

**Decisión:** Template con texto simple (sin botones quick_reply)

**Razones:**
- Más fácil de aprobar por Meta
- No requiere mapeo de IDs de botones
- El flujo conversacional usa listas interactivas después

**Alternativa:** Template con botones quick_reply
- Requiere mapear IDs de botones a IDs de ChatbotMessage
- Más complejo de implementar
- Puede ser implementado después si es necesario

### 3. Rate Limiting

**Decisión:** Cola con delay de 20 segundos entre mensajes

**Razones:**
- Evita throttling de Meta
- Patrón ya usado en `SendExternalWhatsAppMessageV2Meta`
- Configurable por variable de entorno

### 4. Respuesta Después de Sesión Cerrada

**Decisión:** Ignorar mensaje (no crear ticket nuevo)

**Razones:**
- El bot proactivo tiene un propósito específico
- Evita confusión con sesiones antiguas
- El sistema externo decide cuándo reiniciar

**Alternativa:** Crear ticket sin bot para agente
- Puede implementarse después si es necesario
- Requiere lógica adicional en `HandleMetaWebhookMessage`

### 5. Configuración de Timeout

**Decisión:** Usar `timeToWaitInMinutes` del nodo raíz de ChatbotMessage

**Razones:**
- Reutiliza campo existente
- Consistente con bots reactivos
- Configurable por bot

### 6. Reporte de Resultados

**Decisión:** Envío inmediato por evento (no en lote)

**Razones:**
- El sistema externo puede actuar inmediatamente
- Más simple de implementar
- Menos riesgo de pérdida de datos

**Alternativa:** Reporte en lote periódico
- Más eficiente para grandes volúmenes
- Puede implementarse después si es necesario

---

## Configuración Requerida

### Variables de Entorno

```bash
# URL del sistema externo para reportar resultados
EXTERNAL_API_RESULT_URL=https://api.external.com/api/inactivity-result

# Timeout de sesiones proactivas (minutos)
PROACTIVE_BOT_TIMEOUT_MINUTES=180

# Delay entre envíos de templates (milisegundos)
PROACTIVE_BOT_SEND_DELAY_MS=20000
```

### Template en Meta

**Nombre:** `inicio_inactividad`

**Categoría:** UTILITY

**Idioma:** Español (es)

**Contenido sugerido:**
```
Hola 👋

Notamos que no has interactuado recientemente con nosotros.

¿Te gustaría continuar?
```

**Nota:** Debe ser aprobado por Meta antes de usar.

---

## Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Template rechazado por Meta | Alto | Revisar políticas, usar texto genérico |
| Rate limiting de Meta | Medio | Cola con delay configurable |
| Sistema externo caído | Medio | Reintentos con backoff exponencial |
| Timeout muy corto | Bajo | Configurar `timeToWaitInMinutes` adecuado |
| Usuario responde después de cerrar | Bajo | Ignorar mensaje, documentar comportamiento |
| Costos de templates | Medio | Monitorear uso, alertas de presupuesto |

---

## Métricas a Monitorear

1. **Templates enviados:** Total por día/semana
2. **Tasa de respuesta:** % usuarios que responden
3. **Tasa de completado:** % usuarios que completan flujo
4. **Tasa de timeout:** % usuarios que no responden
5. **Errores de envío:** Fallos al enviar template
6. **Tiempo promedio de sesión:** Desde envío hasta completar/timeout
7. **Costo por conversación:** Basado en pricing de Meta

---

## Próximos Pasos

1. Revisar y aprobar este documento
2. Crear template en Meta Business Manager
3. Iniciar Fase 1: Migraciones de BD
4. Continuar con fases secuencialmente
5. Probar en ambiente de desarrollo
6. Desplegar a producción

---

## Contactos y Referencias

- **Documentación Meta Templates:** https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates
- **Pricing Meta:** https://developers.facebook.com/docs/whatsapp/pricing
- **Políticas de WhatsApp:** https://www.whatsapp.com/legal/business-policy

---

## Resumen de Cambios Clave (Nueva Arquitectura)

### ✅ Cambios Principales

1. **Nueva Tabla `ProactiveBotSessions`**
   - Almacena sesiones del bot proactivo
   - NO usa tablas Tickets ni Contacts
   - Guarda TODAS las interacciones del usuario en JSON
   - Incluye respuesta libre final

2. **Nuevo Servicio `HandleProactiveBotInactivityMessage`**
   - Maneja TODO el flujo del bot proactivo
   - Navega por el árbol de ChatbotMessage
   - Detecta nodos terminales (texto libre)
   - Guarda cada respuesta del usuario

3. **Modificación en `HandleMetaWebhookMessage`**
   - Detecta sesiones proactivas PRIMERO
   - Si existe sesión activa → delega a handler especializado
   - Si NO existe sesión → flujo normal de tickets

4. **Nuevo Servicio `ReportProactiveBotResultService`**
   - Envía TODA la interacción al sistema externo
   - Incluye array completo de respuestas del usuario
   - Se ejecuta al completar o hacer timeout

5. **Nuevo CRON `CheckExpiredProactiveBotSessions`**
   - Detecta sesiones que no responden
   - Cierra sesiones expiradas
   - Reporta con estado NO_RESPONSE

### 🔄 Flujo Simplificado

```
Sistema Externo → Envío Template → Sesión Activa
                                         ↓
                                   Usuario Responde
                                         ↓
                                   Navegación Árbol
                                         ↓
                                   Nodo Terminal
                                         ↓
                                   Texto Libre
                                         ↓
                              Enviar TODO al Sistema Externo
```

### 📊 Datos Enviados al Sistema Externo

```json
{
  "phone": "521234567890",
  "status": "COMPLETED",
  "botIdentifier": "inactividad",
  "interactions": [
    { "step": "...", "userResponse": "...", "timestamp": "..." },
    { "step": "...", "userResponse": "...", "timestamp": "..." }
  ],
  "finalResponse": "Mi sistema no abre...",
  "startedAt": "2026-04-08T10:00:00Z",
  "completedAt": "2026-04-08T10:02:00Z"
}
```

---

**Última actualización:** 2026-04-08
**Versión:** 2.0
**Estado:** Diseño actualizado - Listo para implementación
